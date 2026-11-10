// Phase 3b-5: restore core (spec §5.3, H12) and PDF links (spec §5.5 PDF, H14).
import { describe, expect, it } from './runner.js';
import { BUILTIN_PATTERNS, setPersonalHosts } from '../../assets/js/upstream/core/patterns.js';
import { CodeBook } from '../../assets/js/upstream/core/codes.js';
import { resplitItems } from '../../assets/js/upstream/core/detector.js';
import { applyRedactions } from '../../assets/js/upstream/core/redactor.js';
import { parseMapping, serializeMapping } from '../../assets/js/upstream/core/csv.js';
import { generateDocument, parseDocument } from '../../assets/js/upstream/formats/index.js';
import { detectDocument, detectShort } from '../../assets/js/jill/detect.js';
import { scanUri } from '../../assets/js/jill/uri-scan.js';
import { redactWithLinks, textLinks } from '../../assets/js/jill/links/markdown.js';
import { redactLinks } from '../../assets/js/jill/links/rels.js';
import { restoreDocument } from '../../assets/js/jill/links/restore.js';
import { PDFDocument, PDFName, PDFRawStream, PDFString, StandardFonts, decodePDFRawStream } from '../../assets/vendor/pdf-lib.esm.min.js';

const PREVIEW = { mode: 'preview' };
const sid = { id: 'org-1', category: '學號', regex: '(?<=[?&]sid=)[^&#\\s]+', enabled: true, applyToUrl: true, source: 'org' };
const PATTERNS = [...BUILTIN_PATTERNS, sid];

/** De-identify as the processing page does (部分保留, code, mask_pii_in_url) and return the output file + CSV text. */
async function deidentify(file) {
  const doc = await parseDocument(file);
  const book = new CodeBook();
  const { items } = await detectDocument(doc, PATTERNS, book);
  resplitItems(items, book, () => PREVIEW);
  const decide = (uri) => scanUri(uri, PATTERNS, book, { retentionOf: () => PREVIEW });
  const scan = (s) => {
    const it = detectShort(s, PATTERNS, book);
    resplitItems(it, book, () => PREVIEW);
    return applyRedactions(s, it);
  };
  const r = ['docx', 'xlsx', 'pdf'].includes(doc.format)
    ? redactLinks(doc.links ?? [], applyRedactions(doc.text, items), 'code', decide, scan)
    : redactWithLinks(doc.text, items, 'code', textLinks(doc), decide);
  const out = new File([await generateDocument(doc, r.edits, r.links)], file.name.replace(/(\.[^.]+)$/, '.deid$1'));
  return { doc, r, out, csv: serializeMapping(r.mapping) };
}

/** Restore the output with the CSV (read back as a user would) and parse the restored file again. */
async function restoreFile(out, csv) {
  const { entries, errors } = parseMapping(csv);
  const deid = await parseDocument(out);
  const r = restoreDocument(deid, entries);
  const restored = await parseDocument(new File([await generateDocument(deid, r.edits, r.links)], out.name.replace('.deid', '.restored')));
  return { errors, deid, r, restored };
}
const fixture = async (name) => new File([await (await fetch(`fixtures/${name}`)).blob()], name);
const targets = (doc) => (doc.links ?? []).map((l) => l.uri);

describe('restore core (spec §5.3, H12)', () => {
  setPersonalHosts(['facebook.com']);

  it('H12 Markdown: H1–H3, H10, H13, H17 links and their text come back byte for byte', async () => {
    const text = [
      '[信箱](mailto:wang.xm@school.edu.tw "寫信給王小明")', // H1
      '[電話](tel:0912-345-678)', // H2
      '[查詢](https://school.edu.tw/s?id=A123456789&name=%E7%8E%8B%E5%B0%8F%E6%98%8E)', // H3
      '[個人頁](https://www.facebook.com/wang.xiaoming)', // H10
      '[舊系統](https://school.edu.tw/s?name=%E7%8E&x=1)', // H13
      '[成績](https://school.edu.tw/q?sid=112001&other=112001)', // H17
      '導師王小明，身分證 A123456789。',
    ].join('\n');
    const { r, out, csv } = await deidentify(new File([text], 'h12.md'));
    for (const leak of ['wang.xm', '345-678', 'A123456789', '%E5%B0%8F', 'wang.xiaoming', '%E7%8E&', '112001&']) expect(r.redactedText).not.toContain(leak);
    const { errors, r: back, restored } = await restoreFile(out, csv);
    expect(errors).toEqual([]);
    expect(back.missingCodes).toEqual([]);
    expect(restored.text).toBe(text);
    expect(restored.text).not.toContain('%2F'); // H10: the page path stays a path
  });

  it('H12 DOCX made by Word: text, targets and ScreenTips restored', async () => {
    const original = await parseDocument(await fixture('links.docx'));
    const { out, csv, r } = await deidentify(await fixture('links.docx'));
    expect(r.links.filter((l) => l.decision.action === 'rewrite').length > 2).toBe(true);
    const { r: back, restored } = await restoreFile(out, csv);
    expect(back.missingCodes).toEqual([]);
    expect(restored.text).toBe(original.text);
    expect(targets(restored).map(decodeURIComponent)).toEqual(targets(original).map(decodeURIComponent));
    expect(restored.links.map((l) => l.texts)).toEqual(original.links.map((l) => l.texts));
  });

  it('H12 XLSX made by Excel: cells, comments, targets, display texts and the HYPERLINK formula restored', async () => {
    const original = await parseDocument(await fixture('links.xlsx'));
    const { out, csv } = await deidentify(await fixture('links.xlsx'));
    const { r: back, restored } = await restoreFile(out, csv);
    expect(back.missingCodes).toEqual([]);
    expect(restored.text).toBe(original.text);
    expect(targets(restored).map(decodeURIComponent)).toEqual(targets(original).map(decodeURIComponent));
    expect(restored.links.map((l) => l.texts)).toEqual(original.links.map((l) => l.texts));
  });

  it('codes missing from the table are listed and left in place', async () => {
    const { out } = await deidentify(new File(['[信箱](mailto:wang.xm@school.edu.tw)'], 'm.md'));
    const { r: back, restored } = await restoreFile(out, 'code,category,original\r\n');
    expect(back.missingCodes.length).toBe(1);
    expect(restored.text).toContain('mailto:%5B');
  });
});

describe('PDF links (spec §5.5 PDF, H14)', () => {
  it('H14 a /Link with an ID: listed with a warning, gone from the output with the ID', async () => {
    const src = await PDFDocument.create();
    const page = src.addPage([300, 200]);
    page.drawText('ID A123456789 see link', { x: 20, y: 100, size: 12, font: await src.embedFont(StandardFonts.Helvetica) });
    const annot = src.context.obj({
      Type: 'Annot', Subtype: 'Link', Rect: [20, 95, 200, 115], Border: [0, 0, 0],
      A: { Type: 'Action', S: 'URI', URI: PDFString.of('https://school.edu.tw/s?id=A123456789') },
    });
    page.node.set(PDFName.of('Annots'), src.context.obj([src.context.register(annot)]));
    const file = new File([await src.save({ useObjectStreams: false })], 'h14.pdf');

    const { doc, r, out } = await deidentify(file);
    expect(doc.links.map((l) => [l.kind, l.uri, l.writable])).toEqual([['pdf', 'https://school.edu.tw/s?id=A123456789', false]]);
    expect(r.links.map((l) => [l.decision.action, l.decision.warnings[0]])).toEqual([['strip', 'pdf']]);
    expect(r.mapping.some((m) => m.original.includes('23456789'))).toBe(true); // the text ID, not a link hit

    // every object decoded (like qpdf --qdf): no /URI, no link annotation, no ID
    const pdf = await PDFDocument.load(await out.arrayBuffer());
    let all = '';
    for (const [, obj] of pdf.context.enumerateIndirectObjects()) {
      all += obj instanceof PDFRawStream ? new TextDecoder('latin1').decode(decodePDFRawStream(obj).decode()) : obj.toString();
    }
    for (const leak of ['/URI', '/Link', 'A123456789']) expect(all).not.toContain(leak);
    expect((await parseDocument(out)).links).toEqual([]);
  });
});
