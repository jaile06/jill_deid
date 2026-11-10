import '../../../vendor/jszip.min.js';
const JSZip = globalThis.JSZip;
                                                                              
import { distributeEdits,              } from './segments.js';
import { dropCalcChain, scrubXlsx, writeXlsxLinks, xlsxLinks } from '../../jill/links/xlsx.js'; // jill_deid patch (PATCHES.md P1-8)

const MAIN_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const XML_NS = 'http://www.w3.org/XML/1998/namespace';
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

                   
                   
                                                                                                         
                  
 

                     
               
                
 

                             
             
                      
                                                                                          
                                  
                      
                   
 

function isMain(el         , local        )          {
  return el.namespaceURI === MAIN_NS && el.localName === local;
}

function textOf(el         )         {
  // Concatenates every <t> under a <si>/<is>, covering rich-text runs (<r><t>).
  let out = '';
  const walk = (n         ) => {
    if (isMain(n, 't')) {
      out += n.textContent ?? '';
      return;
    }
    if (isMain(n, 'rPh')) return; // phonetic hints are not visible cell text
    for (const c of Array.from(n.children)) walk(c);
  };
  walk(el);
  return out;
}

function parseXml(xml        , path        )           {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) throw new Error(`無法解析 ${path}`);
  return doc;
}

async function loadSharedStrings(zip       )                    {
  const file = zip.file('xl/sharedStrings.xml');
  if (!file) return [];
  const doc = parseXml(await file.async('string'), 'xl/sharedStrings.xml');
  return Array.from(doc.documentElement.children)
    .filter((si) => isMain(si, 'si'))
    .map(textOf);
}

function cellCoords(ref        )                               {
  const m = ref.match(/^([A-Z]+)(\d+)$/i);
  if (!m) return { row: 0, col: 0 };
  let col = 0;
  for (const ch of m[1].toUpperCase()) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { row: Number(m[2]), col };
}

async function sheetPaths(zip       )                                            {
  // Prefer workbook order; fall back to numeric file order.
  const wb = zip.file('xl/workbook.xml');
  const rels = zip.file('xl/_rels/workbook.xml.rels');
  if (wb && rels) {
    const wbDoc = parseXml(await wb.async('string'), 'xl/workbook.xml');
    const relDoc = parseXml(await rels.async('string'), 'xl/_rels/workbook.xml.rels');
    const targets = new Map                ();
    for (const r of Array.from(relDoc.documentElement.children)) {
      const id = r.getAttribute('Id');
      const target = r.getAttribute('Target');
      if (id && target) targets.set(id, target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`);
    }
    const out                                   = [];
    for (const s of Array.from(wbDoc.getElementsByTagNameNS(MAIN_NS, 'sheet'))) {
      const rid = s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
      const p = rid ? targets.get(rid) : undefined;
      if (p && zip.file(p)) out.push({ path: p, name: s.getAttribute('name') ?? p });
    }
    if (out.length) return out;
  }
  return Object.keys(zip.files)
    .filter((p) => /^xl\/worksheets\/sheet\d+\.xml$/.test(p))
    .sort((a, b) => Number(a.match(/\d+/) [0]) - Number(b.match(/\d+/) [0]))
    .map((path) => ({ path, name: path.replace(/^.*\//, '').replace(/\.xml$/, '') }));
}

/**
 * Text-bearing cells in document order: shared-string and inline-string cells, and (jill_deid patch,
 * PATCHES.md P0-2) plain numeric cells, where rosters keep 學號 and 座號. Formula results stay out:
 * rewriting one would drop its <f>.
 */
const isNumeric = (c         ) => {
  const t = c.getAttribute('t');
  return (t === null || t === 'n') && c.getElementsByTagNameNS(MAIN_NS, 'f').length === 0;
};

function textCells(doc          )            {
  return Array.from(doc.getElementsByTagNameNS(MAIN_NS, 'c')).filter((c) => {
    const t = c.getAttribute('t');
    return t === 's' || t === 'inlineStr' || isNumeric(c);
  });
}

function cellText(c         , shared          )         {
  if (c.getAttribute('t') === 's') {
    const v = c.getElementsByTagNameNS(MAIN_NS, 'v')[0];
    const idx = Number(v?.textContent ?? '');
    return Number.isInteger(idx) ? (shared[idx] ?? '') : '';
  }
  if (isNumeric(c)) return c.getElementsByTagNameNS(MAIN_NS, 'v')[0]?.textContent ?? '';
  const is = c.getElementsByTagNameNS(MAIN_NS, 'is')[0];
  return is ? textOf(is) : '';
}

// jill_deid patch (PATCHES.md P1-8): legacy comments (<t> runs) and threaded comments (<text>)
const isNotePath = (p) => /^xl\/comments\d*\.xml$/.test(p) || /^xl\/threadedComments\/[^/]+\.xml$/.test(p);
const noteNodes = (doc) => Array.from(doc.getElementsByTagName('*')).filter((n) => (n.namespaceURI === MAIN_NS && n.localName === 't') || n.localName === 'text' && n.namespaceURI !== MAIN_NS);

function rowOf(c         )         {
  return (c.getAttribute('r') ?? '').replace(/[A-Z]+/i, '');
}

export async function parseXlsx(file      )                          {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const paths = await sheetPaths(zip);
  if (paths.length === 0) throw new Error('不是有效的 Excel (.xlsx) 檔案');
  const shared = await loadSharedStrings(zip);

  const sheets              = [];
  const segments            = [];
  const cells            = [];
  const layoutSheets                                              = [];
  let text = '';

  for (const [sheetIdx, { path, name }] of paths.entries()) {
    const doc = parseXml(await zip.file(path) .async('string'), path);
    sheets.push({ path, doc });
    const layoutCells                   = [];
    let lastRow = '';
    textCells(doc).forEach((c, cellIdx) => {
      const t = cellText(c, shared);
      if (t.length === 0) return;
      const row = rowOf(c);
      if (text.length > 0 && !text.endsWith('\n')) text += row === lastRow ? '\t' : '\n';
      lastRow = row;
      const coords = cellCoords(c.getAttribute('r') ?? '');
      segments.push({ start: text.length, end: text.length + t.length, text: t });
      layoutCells.push({ start: text.length, end: text.length + t.length, ...coords });
      cells.push({ sheetIdx, cellIdx });
      text += t;
    });
    layoutSheets.push({ name, cells: layoutCells });
    if (!text.endsWith('\n')) text += '\n';
    text += '\n';
  }

  // jill_deid patch (PATCHES.md P1-8): comment text joins the scan (spec §5.5 XLSX 3), one segment per text node
  const notes = [];
  for (const path of Object.keys(zip.files).filter(isNotePath).sort()) {
    const noteDoc = parseXml(await zip.file(path).async('string'), path);
    notes.push({ path, doc: noteDoc });
    for (const [nodeIdx, n] of noteNodes(noteDoc).entries()) {
      const t = n.textContent ?? '';
      if (!t) continue;
      segments.push({ start: text.length, end: text.length + t.length, text: t });
      cells.push({ note: notes.length - 1, nodeIdx });
      text += `${t}\n`;
    }
  }
  // links outside the text (spec §5.5 XLSX 1–2), with the original XML they live in
  const ranges = new Map();
  const sheetCells = sheets.map((s) => textCells(s.doc));
  for (const [i, ref] of cells.entries()) {
    if (ref.note !== undefined) continue;
    const c = sheetCells[ref.sheetIdx][ref.cellIdx];
    ranges.set(`${sheets[ref.sheetIdx].path}!${c.getAttribute('r')}`, [segments[i].start, segments[i].end]);
  }
  const pristine = new Map();
  const links = await xlsxLinks(zip, sheets, pristine, (path, ref) => ranges.get(`${path}!${(ref ?? '').split(':')[0]}`));
  const sharedStringsXml = (await zip.file('xl/sharedStrings.xml')?.async('string')) ?? null;
  const handle             = { zip, sheets, sharedStringsXml, segments, cells, notes, pristine };
  return { fileName: file.name, format: 'xlsx', text, handle, layout: { kind: 'xlsx', sheets: layoutSheets }, links };
}

function setInlineString(c         , value        )       {
  const doc = c.ownerDocument;
  for (const child of Array.from(c.children)) {
    if (isMain(child, 'v') || isMain(child, 'is') || isMain(child, 'f')) c.removeChild(child);
  }
  c.setAttribute('t', 'inlineStr');
  const is = doc.createElementNS(MAIN_NS, 'is');
  const t = doc.createElementNS(MAIN_NS, 't');
  t.setAttributeNS(XML_NS, 'xml:space', 'preserve');
  t.textContent = value;
  is.append(t);
  c.append(is);
}

function serialize(doc          )         {
  const xml = new XMLSerializer().serializeToString(doc);
  return xml.startsWith('<?xml') ? xml : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n${xml}`;
}

/** Empties every <si> that no cell references any more, so redacted values cannot linger in the archive. */
function scrubSharedStrings(xml        , referenced             )         {
  const doc = parseXml(xml, 'xl/sharedStrings.xml');
  Array.from(doc.documentElement.children)
    .filter((si) => isMain(si, 'si'))
    .forEach((si, idx) => {
      if (referenced.has(idx)) return;
      while (si.firstChild) si.removeChild(si.firstChild);
      const t = doc.createElementNS(MAIN_NS, 't');
      si.append(t);
    });
  return serialize(doc);
}

/**
 * Changed cells are rewritten as inline strings so every cell keeps its own code even when
 * several cells originally shared one entry in sharedStrings.xml. Styles (the `s` attribute)
 * and every other part of the workbook are untouched, except that shared-string entries no
 * longer referenced by any cell are blanked (see scrubSharedStrings).
 */
// jill_deid patch (PATCHES.md P1-8): `links` are the decided link targets ([{ link, decision }], see
// jill/links/xlsx.js); comment text is rewritten in place; comment authors and properties are always cleared.
export async function generateXlsx(doc                , edits            , links = [], opts = {})                {
  const handle = doc.handle              ;
  const changes = distributeEdits(handle.segments, edits);

  const perSheet = new Map                             ();
  const perNote = new Map();
  for (const [segIdx, newText] of changes) {
    const ref = handle.cells[segIdx];
    if (ref.note !== undefined) {
      if (!perNote.has(ref.note)) perNote.set(ref.note, new Map());
      perNote.get(ref.note).set(ref.nodeIdx, newText);
      continue;
    }
    if (!perSheet.has(ref.sheetIdx)) perSheet.set(ref.sheetIdx, new Map());
    perSheet.get(ref.sheetIdx) .set(ref.cellIdx, newText);
  }

  for (const [path, xml] of handle.pristine ?? []) handle.zip.file(path, xml); // undo an earlier download
  const clones = new Map();
  for (const [sheetIdx, sheet] of handle.sheets.entries()) {
    const clone = sheet.doc.cloneNode(true)            ;
    const cellChanges = perSheet.get(sheetIdx);
    if (cellChanges) {
      const cells = textCells(clone);
      for (const [cellIdx, value] of cellChanges) setInlineString(cells[cellIdx], value);
    }
    clones.set(sheet.path, clone);
  }
  for (const [i, note] of (handle.notes ?? []).entries()) {
    const clone = note.doc.cloneNode(true);
    const nodes = noteNodes(clone);
    for (const [nodeIdx, value] of perNote.get(i) ?? []) {
      nodes[nodeIdx].textContent = value;
      if (nodes[nodeIdx].localName === 't') nodes[nodeIdx].setAttributeNS(XML_NS, 'xml:space', 'preserve');
    }
    handle.zip.file(note.path, serialize(clone));
  }
  if (writeXlsxLinks(handle.zip, clones, handle.pristine ?? new Map(), links)) await dropCalcChain(handle.zip);
  await scrubXlsx(handle.zip, opts);

  const referenced = new Set        ();
  for (const [path, clone] of clones) {
    for (const c of Array.from(clone.getElementsByTagNameNS(MAIN_NS, 'c'))) {
      if (c.getAttribute('t') !== 's') continue;
      const idx = Number(c.getElementsByTagNameNS(MAIN_NS, 'v')[0]?.textContent ?? '');
      if (Number.isInteger(idx)) referenced.add(idx);
    }
    handle.zip.file(path, serialize(clone));
  }
  if (handle.sharedStringsXml !== null) {
    handle.zip.file('xl/sharedStrings.xml', scrubSharedStrings(handle.sharedStringsXml, referenced));
  }
  return handle.zip.generateAsync({ type: 'blob', mimeType: XLSX_MIME, compression: 'DEFLATE' });
}
