import '../../../vendor/jszip.min.js';
const JSZip = globalThis.JSZip;
                                                                                   
import { distributeEdits,              } from './segments.js';
import { docxLinks, scrubDocx, writeDocxLinks } from '../../jill/links/docx.js'; // jill_deid patch (PATCHES.md P1-7)

const W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const MC_NS = 'http://schemas.openxmlformats.org/markup-compatibility/2006';
const XML_NS = 'http://www.w3.org/XML/1998/namespace';
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

                    
               
                
                   
                      
                                    
 

                             
             
                    
 

function isW(el         , local        )          {
  return el.namespaceURI === W_NS && el.localName === local;
}

let tableSeq = 0;

function styleOf(p         )                               {
  const val = p.getElementsByTagNameNS(W_NS, 'pStyle')[0]?.getAttributeNS(W_NS, 'val') ?? '';
  if (/title/i.test(val)) return 'title';
  if (/heading|^h\d/i.test(val)) return 'heading';
  return 'normal';
}

/** Walks a part in document order, collecting <w:t> nodes, the full text they form, and paragraph/table layout. */
function extractPart(path        , doc          , offset        )                                   {
  const nodes            = [];
  const segments            = [];
  const paragraphs                        = [];
  const partKind                              = /header/.test(path) ? 'header' : /footer/.test(path) ? 'footer' : 'body';
  const tableStack                                             = [];
  let text = '';

  const visit = (el         ) => {
    if (el.namespaceURI === MC_NS && el.localName === 'Fallback') return;
    if (isW(el, 'del') || isW(el, 'delText')) return;
    if (isW(el, 'tbl')) {
      tableStack.push({ id: tableSeq++, row: -1, col: -1 });
      for (const child of Array.from(el.children)) visit(child);
      tableStack.pop();
      return;
    }
    if (isW(el, 'tr') && tableStack.length) {
      const t = tableStack[tableStack.length - 1];
      t.row++;
      t.col = -1;
      for (const child of Array.from(el.children)) visit(child);
      return;
    }
    if (isW(el, 'tc') && tableStack.length) {
      tableStack[tableStack.length - 1].col++;
      for (const child of Array.from(el.children)) visit(child);
      return;
    }
    if (isW(el, 'p')) {
      const start = offset + text.length;
      for (const child of Array.from(el.children)) visit(child);
      const t = tableStack[tableStack.length - 1];
      paragraphs.push({ start, end: offset + text.length, style: styleOf(el), part: partKind, table: t ? { id: t.id, row: t.row, col: t.col } : undefined });
      text += '\n';
      return;
    }
    if (isW(el, 't')) {
      const t = el.textContent ?? '';
      if (t.length > 0) {
        nodes.push(el);
        segments.push({ start: offset + text.length, end: offset + text.length + t.length, text: t });
        text += t;
      }
      return;
    }
    if (isW(el, 'tab')) {
      text += '\t';
      return;
    }
    if (isW(el, 'br') || isW(el, 'cr')) {
      text += '\n';
      return;
    }
    for (const child of Array.from(el.children)) visit(child);
  };

  visit(doc.documentElement);
  return { part: { path, doc, nodes, segments, paragraphs, offset }, text };
}

function partOrder(paths          )           {
  const main = paths.filter((p) => p === 'word/document.xml');
  const rest = paths.filter((p) => /^word\/(header|footer)\d*\.xml$/.test(p)).sort();
  // jill_deid patch (PATCHES.md P1-7): footnotes, endnotes and comments are scanned too (spec §5.5 DOCX 5)
  const notes = ['word/footnotes.xml', 'word/endnotes.xml', 'word/comments.xml'].filter((p) => paths.includes(p));
  return [...main, ...rest, ...notes];
}

export async function parseDocx(file      )                          {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const paths = partOrder(Object.keys(zip.files));
  if (!paths.includes('word/document.xml')) throw new Error('不是有效的 Word (.docx) 檔案');

  const parser = new DOMParser();
  const parts             = [];
  let text = '';
  for (const path of paths) {
    const xml = await zip.file(path) .async('string');
    const doc = parser.parseFromString(xml, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length > 0) throw new Error(`無法解析 ${path}`);
    const { part, text: partText } = extractPart(path, doc, text.length);
    parts.push(part);
    text += partText;
    if (!text.endsWith('\n')) text += '\n';
  }
  // jill_deid patch (PATCHES.md P1-7): link targets outside the text (spec §5.5 DOCX 1–3), with the original
  // XML of the files they live in, so every download starts from the original.
  const pristine = new Map();
  const links = await docxLinks(zip, parts, pristine);
  const handle             = { zip, parts, pristine };
  const layout = { kind: 'docx'         , paragraphs: parts.flatMap((p) => p.paragraphs) };
  return { fileName: file.name, format: 'docx', text, handle, layout, links };
}

function serialize(doc          )         {
  const xml = new XMLSerializer().serializeToString(doc);
  return xml.startsWith('<?xml') ? xml : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n${xml}`;
}

/** Every call works on a fresh clone of the pristine parts so repeated downloads stay correct. */
// jill_deid patch (PATCHES.md P1-7): `links` are the decided link targets ([{ link, decision }], see
// jill/links/docx.js); residue (text-box fallback, tracked deletions, reviewer names, properties) is always removed.
export async function generateDocx(doc                , edits            , links = [])                {
  const handle = doc.handle              ;
  const clones = new Map();
  for (const part of handle.parts) {
    const partStart = part.segments[0]?.start ?? 0;
    const partEnd = part.segments.at(-1)?.end ?? 0;
    const partEdits = edits.filter((e) => e.start < partEnd && e.end > partStart);

    const cloneDoc = part.doc.cloneNode(true)            ;
    // jill_deid patch (PATCHES.md P0-1): re-extract at the part's own offset. Upstream used the first
    // <w:t>'s start, which is off by any empty paragraph, tab or break before it.
    const { part: clone } = extractPart(part.path, cloneDoc, part.offset);
    const changes = distributeEdits(clone.segments, partEdits);
    for (const [i, newText] of changes) {
      const node = clone.nodes[i];
      node.textContent = newText;
      node.setAttributeNS(XML_NS, 'xml:space', 'preserve');
    }
    clones.set(part.path, cloneDoc);
  }
  for (const [path, xml] of handle.pristine ?? []) handle.zip.file(path, xml); // undo an earlier download
  writeDocxLinks(handle.zip, clones, handle.pristine ?? new Map(), links);
  await scrubDocx(handle.zip, clones);
  for (const [path, cloneDoc] of clones) handle.zip.file(path, serialize(cloneDoc));
  return handle.zip.generateAsync({ type: 'blob', mimeType: DOCX_MIME, compression: 'DEFLATE' });
}
