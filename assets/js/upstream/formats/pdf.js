import { assetsBase } from '../../../js/jill/assets.js';
import * as pdfjs from '../../../vendor/pdf.min.js';
                                               
                                                                 
const workerSrc = `${assetsBase}vendor/pdf.worker.min.js`;
import { PDFDocument, PDFFont, PDFPage, rgb } from '../../../vendor/pdf-lib.esm.min.js';
const fontkit = globalThis.fontkit;
                                                                                                              
import { distributeEdits,              } from './segments.js';
import { sparseSubsetTtf } from './ttf-subset.js';
                                        

pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

const FONT_URL = `${assetsBase}fonts/NotoSansTC-Regular.ttf`;

/** One run of text at its position (PDF points, origin bottom-left, y = baseline). */
                              
               
            
            
                   
                
                                                                                   
                
                                                                      
              
 

/** Scanned pages also carry their redrawn structure: pictures, rules, fills and checkboxes. */
                                                
                
                 
                       
 

                            
                   
                                                                                           
                      
                                                                      
                     
                      
 

                                  
                                                                                                                  
                   
 

function fontSizeOf(item          )         {
  const [, , c, d] = item.transform;
  const size = Math.hypot(c, d);
  return size > 0.5 ? size : item.height || 10;
}

async function textLayer(page              )                   {
  const [x0, y0, x1, y1] = page.view;
  const content = await page.getTextContent();
  const items                = [];
  for (const raw of content.items) {
    if (!('str' in raw)) continue;
    const it = raw            ;
    items.push({ text: it.str, x: it.transform[4] - x0, y: it.transform[5] - y0, fontSize: fontSizeOf(it), width: it.width, eol: it.hasEOL });
  }
  return { width: x1 - x0, height: y1 - y0, items };
}

const hasText = (pages           )          => pages.some((pg) => pg.items.some((it) => it.text.trim().length > 0));

export async function parsePdf(file      , opts                  = {})                          {
  const data = new Uint8Array(await file.arrayBuffer());
  const task = pdfjs.getDocument({ data });
  try {
    const pdf = await task.promise;
    const pages            = [];
    for (let p = 1; p <= pdf.numPages; p++) pages.push(await textLayer(await pdf.getPage(p)));
    if (hasText(pages)) return assemblePdf(file.name, pages);
    if (!opts.ocr) throw new Error('此 PDF 沒有可擷取的文字層（可能是掃描影像）；還原請使用本工具輸出的去識別化檔案');
    const scanned = await (await import('./ocr.js')).recognizePdf(pdf, opts.ocr);
    if (!hasText(scanned)) throw new Error('未在此 PDF 的頁面影像中辨識到任何文字');
    return assemblePdf(file.name, scanned, true);
  } finally {
    await task.destroy();
  }
}

/**
 * Joins positioned text items (from the text layer or from OCR) into the document's full text:
 * items on the same baseline share a line, a visible gap becomes a space, pages end with a blank line.
 */
export function assemblePdf(fileName        , rawPages           , ocr = false)                 {
  const pages            = [];
  const segments            = [];
  const itemPage           = [];
  const itemIndex           = [];
  let text = '';

  rawPages.forEach((raw, p) => {
    const items                = [];
    let lastEndX = Number.NaN;
    let lastY = Number.NaN;

    for (const it of raw.items) {
      const { x, y, fontSize: size } = it;
      if (it.text.length > 0) {
        const sameLine = Math.abs(y - lastY) < size * 0.5;
        if (!Number.isNaN(lastY)) {
          if (!sameLine) {
            if (!text.endsWith('\n')) text += '\n';
          } else if (x - lastEndX > size * 0.25 && !text.endsWith(' ')) {
            text += ' ';
          }
        }
        segments.push({ start: text.length, end: text.length + it.text.length, text: it.text });
        itemPage.push(p);
        itemIndex.push(items.length);
        items.push({ text: it.text, x, y, fontSize: size, width: it.width, ...(it.color && { color: it.color }) });
        text += it.text;
        lastEndX = x + it.width;
        lastY = y;
      }
      if (it.eol && !text.endsWith('\n')) {
        text += '\n';
        lastY = Number.NaN;
      }
    }
    pages.push({ width: raw.width, height: raw.height, items, pictures: raw.pictures, rules: raw.rules, fills: raw.fills, checkboxes: raw.checkboxes });
    if (!text.endsWith('\n')) text += '\n';
    text += '\n';
  });

  const handle            = { pages, segments, itemPage, itemIndex };
  const layoutPages = pages.map((pg) => ({ width: pg.width, height: pg.height, items: []                   , pictures: pg.pictures, rules: pg.rules, fills: pg.fills, checkboxes: pg.checkboxes }));
  segments.forEach((seg, i) => {
    const it = pages[itemPage[i]].items[itemIndex[i]];
    layoutPages[itemPage[i]].items.push({ start: seg.start, end: seg.end, x: it.x, y: it.y, fontSize: it.fontSize, width: it.width, ...(it.color && { color: it.color }) });
  });
  const doc                 = { fileName, format: 'pdf', text, handle, layout: { kind: 'pdf', pages: layoutPages } };
  if (ocr) doc.ocr = true;
  return doc;
}

let fontBytesPromise                              = null;
function loadFontBytes()                       {
  if (!fontBytesPromise) {
    fontBytesPromise = fetch(FONT_URL).then((r) => {
      if (!r.ok) throw new Error('無法載入中文字型，PDF 輸出失敗');
      return r.arrayBuffer();
    });
  }
  return fontBytesPromise;
}

function sanitizeForFont(text        , supported             )         {
  let out = '';
  for (const ch of text) {
    const cp = ch.codePointAt(0) ;
    out += supported.has(cp) ? ch : cp < 0x20 ? '' : '?';
  }
  return out;
}

function fitSize(font         , text        , size        , maxWidth        )         {
  if (maxWidth <= 0 || text.length === 0) return size;
  const w = font.widthOfTextAtSize(text, size);
  if (w <= maxWidth * 1.02) return size;
  return Math.max(4, (size * maxWidth) / w);
}

const colour = ([r, g, b]     ) => rgb(r / 255, g / 255, b / 255);

/** A checkbox redrawn as a square, with a tick when it was checked (the font has no ☐/☑ glyphs). */
function drawCheckbox(page         , b             )       {
  const line = Math.max(0.5, b.size * 0.09);
  page.drawRectangle({ x: b.x, y: b.y, width: b.size, height: b.size, borderColor: colour(b.color), borderWidth: line });
  if (!b.checked) return;
  const p = (u        , v        ) => ({ x: b.x + b.size * u, y: b.y + b.size * v });
  page.drawLine({ start: p(0.2, 0.5), end: p(0.42, 0.25), thickness: line * 1.4, color: colour(b.color) });
  page.drawLine({ start: p(0.42, 0.25), end: p(0.82, 0.8), thickness: line * 1.4, color: colour(b.color) });
}

/**
 * OCR runs: the width up to the next run on the same line (or the right margin), so a table cell's
 * text never runs into the next cell; recognised font sizes are only estimates.
 */
function roomOnLine(pg         , it             )         {
  let room = Math.max(it.width, pg.width - it.x - 36);
  for (const o of pg.items) {
    if (o.x > it.x && Math.abs(o.y - it.y) < Math.min(o.fontSize, it.fontSize) * 0.5) room = Math.min(room, o.x - it.x - 2);
  }
  // A checkbox or a table's vertical rule further along the line ends it too.
  const [low, high] = [it.y, it.y + it.fontSize * 0.7];
  const stop = (x        ) => {
    if (x > it.x + it.fontSize * 0.5) room = Math.min(room, x - it.x - 2);
  };
  for (const b of pg.checkboxes ?? []) if (b.y < high && b.y + b.size > low) stop(b.x);
  for (const r of pg.rules ?? []) {
    if (Math.abs(r.x2 - r.x1) < Math.abs(r.y2 - r.y1) && Math.min(r.y1, r.y2) < high && Math.max(r.y1, r.y2) > low) stop(Math.min(r.x1, r.x2) - r.width / 2);
  }
  return room / 1.02; // fitSize tolerates 2% overflow
}

/**
 * Rebuilds the PDF as text-only pages at the original coordinates. Original bytes are never
 * copied, so no redacted text can survive underneath (see research.md R2); the only images are the
 * text-free pictures cut from scanned pages that the user kept.
 */
export async function generatePdf(doc                , edits            )                {
  const handle = doc.handle             ;
  const changes = distributeEdits(handle.segments, edits);

  const newTexts                                   = new Map();
  for (const [segIdx, newText] of changes) {
    const p = handle.itemPage[segIdx];
    if (!newTexts.has(p)) newTexts.set(p, new Map());
    newTexts.get(p) .set(handle.itemIndex[segIdx], newText);
  }

  // Embed only the glyphs this document draws (see ttf-subset.ts for why not pdf-lib's subsetter).
  let allText = '?';
  handle.pages.forEach((pg, pIdx) => pg.items.forEach((it, iIdx) => (allText += newTexts.get(pIdx)?.get(iIdx) ?? it.text)));
  const out = await PDFDocument.create();
  out.registerFontkit(fontkit);
  const font = await out.embedFont(sparseSubsetTtf(new Uint8Array(await loadFontBytes()), allText), { subset: false });
  const supported = new Set(font.getCharacterSet());

  const embedded = await Promise.all(handle.pages.map((pg) => Promise.all((pg.pictures ?? []).filter((pic) => pic.keep).map(async (pic) => ({ pic, image: await out.embedJpg(pic.jpeg) })))));

  handle.pages.forEach((pg, pIdx) => {
    const page = out.addPage([pg.width, pg.height]);
    // Scanned pages: fills under everything, then the kept pictures, then rules and checkboxes; text on top.
    for (const f of pg.fills ?? []) page.drawRectangle({ x: f.x, y: f.y, width: f.width, height: f.height, color: colour(f.color) });
    // Only the cut-out pictures are copied; the rest of the scanned page never is.
    for (const { pic, image } of embedded[pIdx]) page.drawImage(image, { x: pic.x, y: pic.y, width: pic.width, height: pic.height });
    for (const r of pg.rules ?? []) {
      page.drawLine({ start: { x: r.x1, y: r.y1 }, end: { x: r.x2, y: r.y2 }, thickness: r.width, color: colour(r.color), ...(r.dashed && { dashArray: [r.width * 3, r.width * 2] }) });
    }
    for (const b of pg.checkboxes ?? []) drawCheckbox(page, b);
    const pageChanges = newTexts.get(pIdx);
    pg.items.forEach((it, iIdx) => {
      const changed = pageChanges?.has(iIdx) ?? false;
      const text = sanitizeForFont(changed ? pageChanges .get(iIdx)  : it.text, supported);
      if (text.length === 0) return;
      // Replacement text may run past the original item; let it use the space up to the right
      // margin before shrinking, so whole-line items keep their size.
      const room = Math.max(it.width, pg.width - it.x - 36);
      const size = doc.ocr ? fitSize(font, text, it.fontSize, roomOnLine(pg, it)) : changed ? fitSize(font, text, it.fontSize, room) : it.fontSize;
      page.drawText(text, { x: it.x, y: it.y, size, font, ...(it.color && { color: colour(it.color) }) });
    });
  });

  const bytes = await out.save();
  return new Blob([bytes            ], { type: 'application/pdf' });
}
