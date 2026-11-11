// Ported by tools/port-upstream-tests.mjs from upstream tests/integration/roundtrip-ocr.test.ts; do not edit (spec §9.2).
import { fileScope } from '../vitest-shim.js';
fileScope('integration/roundtrip-ocr.test');
import { LatinBuffer } from '../vitest-shim.js';
// @vitest-environment node
// Runs the real recogniser (Tesseract, the same models the site serves) on the bundled scanned
// sample, so this checks the sample, the line → run conversion, detection and the round trip together.
import { readFileSync } from '../vitest-shim.js';
import * as pdfjs from '../../../../assets/vendor/pdf.min.js';
import { PDFDict, PDFDocument, PDFName, PDFNumber, PDFRawStream } from '../../../../assets/vendor/pdf-lib.esm.min.js';
import Tesseract from '../../../../assets/vendor/tesseract.esm.min.js';
import { beforeAll, describe, expect, it, vi } from '../vitest-shim.js';
import { detect } from '../../../../assets/js/upstream/core/detector.js';
import { BUILTIN_PATTERNS } from '../../../../assets/js/upstream/core/patterns.js';
import { applyRedactions } from '../../../../assets/js/upstream/core/redactor.js';
import { restore } from '../../../../assets/js/upstream/core/restorer.js';
                                                                
import { ocrLinesToItems } from '../../../../assets/js/upstream/formats/ocr.js';
import { assemblePdf, generatePdf, parsePdf,                              } from '../../../../assets/js/upstream/formats/pdf.js';

const FONT = new Uint8Array(readFileSync('public/fonts/NotoSansTC-Regular.ttf'));
const SAMPLE = new Uint8Array(readFileSync('public/samples/scanned.pdf'));
/** The sample's answer key, written with it by `npm run examples` (also used by `npm run eval:ocr`). */
const ANSWER                                                             = JSON.parse(readFileSync('tests/fixtures/scanned-sample.answer.json', 'utf8'));
const LANGS = ['chi_tra', 'eng'];

/** tesseract.js reads every language from one directory, as the site's ocr/lang/ provides them. */

/** Each page's JPEG stream with its pixel width and page size in points. */
async function pageImages(bytes            )                                                                                {
  const pdf = await PDFDocument.load(bytes);
  return pdf.getPages().map((page) => {
    const xobjects = page.node.Resources() .lookup(PDFName.of('XObject'), PDFDict);
    const stream = pdf.context.lookup(xobjects.values()[0])                ;
    const { width, height } = page.getSize();
    return { jpg: stream.contents, pixels: stream.dict.lookup(PDFName.of('Width'), PDFNumber).asNumber(), width, height };
  });
}

let scanned                ;

beforeAll(async () => {
  vi.stubGlobal('fetch', async () => new Response(FONT));

  const site = await parsePdf(new File([SAMPLE], 'scanned.pdf'), { ocr: {} }); // jill_deid port
  scanned = assemblePdf('scanned.pdf', site.handle.pages.map((pg) => ({ width: pg.width, height: pg.height, items: pg.items })), true);
}, 180000);

describe('scanned PDF (OCR) round trip', () => {
  it('the sample has no text layer, so it needs recognition', async () => {
    await expect(parsePdf(new File([SAMPLE            ], 'scanned.pdf'))).rejects.toThrow(/文字層/);
  });

  it('reads at least 95% of the characters on the pages, in any order', () => {
    // NFKC: a fullwidth「：」read as「:」is not an error. Order is ignored: a table may be read by column.
    const bag = (s        ) => {
      const m = new Map                ();
      for (const ch of s.normalize('NFKC').replace(/\s/g, '')) m.set(ch, (m.get(ch) ?? 0) + 1);
      return m;
    };
    const truth = bag(ANSWER.pages.map((p) => p.text).join(''));
    const read = bag(scanned.text);
    let same = 0;
    let total = 0;
    for (const [ch, n] of truth) {
      same += Math.min(n, read.get(ch) ?? 0);
      total += n;
    }
    expect(same / total).toBeGreaterThanOrEqual(0.95);
  });

  it('detects at least 90% of the values planted in the sample (SC-002)', () => {
    const found = new Set(detect(scanned.text, BUILTIN_PATTERNS).map((it) => `${it.category}|${it.original}`));
    const planted = [...new Set(ANSWER.pages.flatMap((p) => p.planted.map(([c, v]) => `${c}|${v}`)))];
    const missed = planted.filter((p) => !found.has(p));
    if (missed.length) console.info(`OCR sample: ${planted.length - missed.length}/${planted.length} detected; missed:`, missed);
    expect((planted.length - missed.length) / planted.length).toBeGreaterThanOrEqual(0.9);
  });

  it('rebuilds a text-only PDF without overlapping runs and restores the recognised text', async () => {
    const items = detect(scanned.text, BUILTIN_PATTERNS);
    const { edits, mapping } = applyRedactions(scanned.text, items);
    const blob = await generatePdf(scanned, edits);
    const raw = LatinBuffer.from(await blob.arrayBuffer()).toString('latin1');
    expect(raw).not.toContain('/Image');

    const out = await parsePdf(new File([blob], 'scanned.deid.pdf'));
    for (const it of items) expect(out.text).not.toContain(it.original);

    // Runs on one line must not run into the next one (FR-012).
    for (const { items: drawn } of out.handle.pages) {
      const runs = drawn.filter((r) => r.text.trim()); // jill_deid port
      for (const a of runs) {
        for (const b of runs) {
          if (b.x > a.x && Math.abs(a.y - b.y) < Math.min(a.fontSize, b.fontSize) * 0.5) expect(a.x + a.width).toBeLessThanOrEqual(b.x + 0.5);
        }
      }
    }

    const restored = restore(out.text, mapping);
    expect(restored.missingCodes).toEqual([]);
    expect(restored.restoredText.replace(/\s/g, '')).toBe(scanned.text.replace(/\s/g, ''));
  });

  it('redraws rules, fills, checkboxes and text colour as shapes, never as an image, and restores the text (005 FR-004, SC-006)', async () => {
    const blue      = [29, 63, 154];
    const grey      = [68, 68, 68];
    const page          = {
      width: 595,
      height: 842,
      items: [
        { text: '姓名 王小明', x: 60, y: 700, fontSize: 12, width: 70, color: blue },
        { text: '手機 0912-345-678', x: 60, y: 670, fontSize: 12, width: 110 },
        { text: '同意', x: 76, y: 640, fontSize: 12, width: 24 },
      ],
      rules: [
        { x1: 50, y1: 690, x2: 545, y2: 690, width: 1, color: grey },
        { x1: 50, y1: 600, x2: 545, y2: 600, width: 1, color: grey, dashed: true },
      ],
      fills: [{ x: 50, y: 690, width: 495, height: 24, color: [228, 228, 228] }],
      checkboxes: [
        { x: 60, y: 639, size: 11, checked: true, color: [34, 34, 34] },
        { x: 120, y: 639, size: 11, checked: false, color: [34, 34, 34] },
      ],
    };
    const doc = assemblePdf('scan.pdf', [page], true);
    const items = detect(doc.text, BUILTIN_PATTERNS);
    expect(items.length).toBeGreaterThan(0);
    const { edits, mapping } = applyRedactions(doc.text, items);
    const bytes = new Uint8Array(await (await generatePdf(doc, edits)).arrayBuffer());
    expect(LatinBuffer.from(bytes).toString('latin1')).not.toContain('/Image');

    const ops = await (await (await pdfjs.getDocument({ data: bytes.slice() }).promise).getPage(1)).getOperatorList();
    const count = (op        ) => ops.fnArray.filter((f) => f === op).length;
    expect(count(pdfjs.OPS.fill) + count(pdfjs.OPS.fillStroke)).toBeGreaterThanOrEqual(1); // the fill
    expect(count(pdfjs.OPS.stroke)).toBeGreaterThanOrEqual(2 + 2 + 2); // rules, checkbox frames, the tick
    expect(count(pdfjs.OPS.setDash)).toBeGreaterThanOrEqual(1);
    const fills = ops.fnArray.flatMap((f, i) => (f === pdfjs.OPS.setFillRGBColor ? [Array.from(ops.argsArray[i]                     ).join()] : []));
    expect(fills).toContain(blue.join());

    const out = await parsePdf(new File([bytes            ], 'scan.deid.pdf'));
    for (const it of items) expect(out.text).not.toContain(it.original);
    expect(restore(out.text, mapping).restoredText.replace(/\s/g, '')).toBe(doc.text.replace(/\s/g, ''));
  });

  it('keeps the text-free pictures the user kept, and only those (FR-022, FR-023)', async () => {
    const jpeg = new Uint8Array(readFileSync('scripts/assets/scan/ssd-product.jpg'));
    const picture = { x: 60, y: 300, width: 200, height: 150, jpeg, keep: true };
    const doc = assemblePdf('scan.pdf', [{ width: 595, height: 842, items: [{ text: '聯絡人 王小明', x: 60, y: 700, fontSize: 12, width: 90 }], pictures: [picture] }], true);
    const images = async () => (LatinBuffer.from(await (await generatePdf(doc, [])).arrayBuffer()).toString('latin1').match(/\/Subtype \/Image/g) ?? []).length;

    expect(await images()).toBe(1);
    picture.keep = false; // the preview's 取消保留 flips the same object the output reads
    expect(await images()).toBe(0);
  });
});
