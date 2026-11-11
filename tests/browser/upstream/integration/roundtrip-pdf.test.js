// Ported by tools/port-upstream-tests.mjs from upstream tests/integration/roundtrip-pdf.test.ts; do not edit (spec §9.2).
import { fileScope } from '../vitest-shim.js';
fileScope('integration/roundtrip-pdf.test');
import { LatinBuffer } from '../vitest-shim.js';
import { readFileSync } from '../vitest-shim.js';
import * as pdfjs from '../../../../assets/vendor/pdf.min.js';
import { beforeAll, describe, expect, it, vi } from '../vitest-shim.js';
import { PDFDocument } from '../../../../assets/vendor/pdf-lib.esm.min.js';
import '../../../../assets/vendor/fontkit.umd.min.js';
const fontkit = globalThis.fontkit;
import { detect } from '../../../../assets/js/upstream/core/detector.js';
import { BUILTIN_PATTERNS } from '../../../../assets/js/upstream/core/patterns.js';
import { applyRedactions } from '../../../../assets/js/upstream/core/redactor.js';
import { restore } from '../../../../assets/js/upstream/core/restorer.js';
import { generatePdf, parsePdf } from '../../../../assets/js/upstream/formats/pdf.js';

const FONT = new Uint8Array(readFileSync('public/fonts/NotoSansTC-Regular.ttf'));

const LINES = [
  '個案姓名：王小明先生（身分證字號 A123456789）',
  '聯絡手機 0912-345-678，Email：xiaoming.wang@example.com',
  '地址：台北市信義區市府路45號8樓',
];

async function buildPdf(lines          )                {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(FONT, { subset: true });
  const page = pdf.addPage([595, 842]);
  lines.forEach((line, i) => page.drawText(line, { x: 50, y: 780 - i * 24, size: 12, font }));
  const bytes = await pdf.save();
  return new File([bytes            ], 'sample.pdf', { type: 'application/pdf' });
}

beforeAll(() => {
  // The font is fetched from the static site at runtime; serve it from disk here.
  vi.stubGlobal('fetch', async () => new Response(FONT));
  // Vite's `?url` worker path is not importable under Node; point pdf.js at the file directly.
});

describe('PDF round trip', () => {
  it('extracts text with positions and rebuilds a text-only PDF without the originals', async () => {
    const doc = await parsePdf(await buildPdf(LINES));
    for (const l of LINES) expect(doc.text.replace(/\s/g, '')).toContain(l.replace(/\s/g, ''));

    const items = detect(doc.text, BUILTIN_PATTERNS);
    const originals = items.map((i) => i.original);
    expect(originals).toContain('A123456789');
    expect(originals).toContain('王小明');
    expect(originals).toContain('xiaoming.wang@example.com');
    expect(originals).toContain('台北市信義區市府路45號8樓');

    const { edits, mapping } = applyRedactions(doc.text, items);
    const blob = await generatePdf(doc, edits);
    const out = await parsePdf(new File([blob], 'out.pdf'));
    for (const o of originals) expect(out.text).not.toContain(o);
    for (const m of mapping) expect(out.text).toContain(`[${m.category}:${m.code}]`);

    // The rebuilt PDF must not embed the original bytes at all (no hidden text underneath).
    const raw = LatinBuffer.from(await blob.arrayBuffer()).toString('latin1');
    expect(raw).not.toContain('A123456789');

    const restored = restore(out.text, mapping);
    expect(restored.missingCodes).toEqual([]);
    expect(restored.restoredText.replace(/\s/g, '')).toBe(doc.text.replace(/\s/g, ''));
  });

  it('rejects a PDF without a text layer', async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage([200, 200]);
    const file = new File([(await pdf.save())            ], 'blank.pdf');
    await expect(parsePdf(file)).rejects.toThrow(/文字層/);
  });
});
