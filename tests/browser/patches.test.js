// Tests for the approved upstream patches (spec §4, P0) and the vendor side-effect imports.
import { describe, expect, it } from './runner.js';
import { generateDocx, parseDocx } from '../../assets/js/upstream/formats/docx.js';
import { generateXlsx, parseXlsx } from '../../assets/js/upstream/formats/xlsx.js';
import { generateDocument, parseDocument } from '../../assets/js/upstream/formats/index.js';
import * as detector from '../../assets/js/upstream/core/detector.js';
import { BUILTIN_PATTERNS } from '../../assets/js/upstream/core/patterns.js';
import { applyRedactions } from '../../assets/js/upstream/core/redactor.js';

const JSZip = globalThis.JSZip;
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const S = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const toFile = async (zip, name) => new File([await zip.generateAsync({ type: 'uint8array' })], name);
const reopen = async (blob) => JSZip.loadAsync(await blob.arrayBuffer());

describe('vendor', () => {
  it('UMD files imported as modules set their globals', async () => {
    await import('../../assets/js/upstream/formats/pdf.js');
    for (const g of ['JSZip', 'fontkit', 'libphonenumber']) expect(globalThis[g] != null).toBe(true);
  });
});

describe('H20 docx part offset', () => {
  const ID_NAME = '<w:t xml:space="preserve">身分證 A123456789 王小明</w:t>';
  const docx = (body, header) => {
    const z = new JSZip();
    z.file('word/document.xml', `<w:document xmlns:w="${W}"><w:body>${body}</w:body></w:document>`);
    if (header) z.file('word/header1.xml', `<w:hdr xmlns:w="${W}">${header}</w:hdr>`);
    return toFile(z, 'a.docx');
  };
  const cases = {
    'document starts with an empty paragraph': ['<w:p/><w:p><w:r>' + ID_NAME + '</w:r></w:p>'],
    'first paragraph starts with a tab': ['<w:p><w:r><w:tab/>' + ID_NAME + '</w:r></w:p>'],
    'header starts with an empty paragraph': ['<w:p><w:r><w:t>本文</w:t></w:r></w:p>', '<w:p/><w:p><w:r>' + ID_NAME + '</w:r></w:p>'],
  };
  for (const [name, [body, header]] of Object.entries(cases)) {
    it(name, async () => {
      const doc = await parseDocx(await docx(body, header));
      const items = detector.detect(doc.text, BUILTIN_PATTERNS);
      expect(items.map((i) => i.original)).toEqual(['A123456789', '王小明']);
      const { redactedText, edits } = applyRedactions(doc.text, items);
      const out = await parseDocx(new File([await generateDocx(doc, edits)], 'b.docx'));
      expect(out.text).toBe(redactedText); // the file says exactly what the preview said
      expect(out.text).toContain('身分證 [身分證:');
    });
  }
});

describe('H21 xlsx numeric cells', () => {
  const xlsx = () => {
    const z = new JSZip();
    z.file('xl/sharedStrings.xml', `<sst xmlns="${S}"><si><t>學號</t></si></sst>`);
    z.file('xl/worksheets/sheet1.xml', `<worksheet xmlns="${S}"><sheetData>` +
      '<row r="1"><c r="A1" t="s"><v>0</v></c></row>' +
      '<row r="2"><c r="A2"><v>115001</v></c><c r="B2" t="n"><v>3</v></c><c r="C2"><f>A2*2</f><v>230002</v></c><c r="D2" s="1"><v>42</v></c></row>' +
      '</sheetData></worksheet>');
    return toFile(z, 'r.xlsx');
  };

  it('reads plain numeric cells, not formula results', async () => {
    const doc = await parseXlsx(await xlsx());
    expect(doc.text).toContain('115001');
    expect(doc.text).toContain('\t3');
    expect(doc.text).not.toContain('230002');
  });

  it('rewrites only the changed numeric cell and keeps formulas and other cells', async () => {
    const doc = await parseXlsx(await xlsx());
    const start = doc.text.indexOf('115001');
    const blob = await generateXlsx(doc, [{ start, end: start + 6, replacement: '[學號:abcdef]' }]);
    const xml = await (await reopen(blob)).file('xl/worksheets/sheet1.xml').async('string');
    expect(xml).not.toContain('115001');
    expect(xml).toContain('[學號:abcdef]');
    expect(xml).toContain('<f>A2*2</f>');
    expect(xml).toContain('<c r="D2" s="1"><v>42</v></c>');
    expect(xml).toContain('<c r="B2" t="n"><v>3</v></c>');
  });
});

describe('samples round-trip with the patches', () => {
  for (const name of ['contract.docx', 'quotation.docx', 'customers.xlsx', 'meeting-notes.md', 'support-email.txt']) {
    it(name, async () => {
      const blob = await (await fetch(`../../assets/samples/${name}`)).blob();
      const doc = await parseDocument(new File([blob], name));
      const items = detector.detect(doc.text, BUILTIN_PATTERNS);
      const { redactedText, edits } = applyRedactions(doc.text, items);
      const out = await parseDocument(new File([await generateDocument(doc, edits)], name));
      expect(items.length > 0).toBe(true);
      expect(out.text).toBe(redactedText);
    });
  }
});

describe('H25 resolveOverlaps', () => {
  // The upstream O(n²) version, kept here as the reference.
  const reference = (cands) => {
    const sorted = [...cands].sort((a, b) => b.end - b.start - (a.end - a.start) || a.start - b.start);
    const chosen = [];
    for (const c of sorted) if (chosen.every((k) => c.end <= k.start || c.start >= k.end)) chosen.push(c);
    return chosen.sort((a, b) => a.start - b.start);
  };

  it('is exported', () => expect(typeof detector.resolveOverlaps).toBe('function'));

  it('matches the reference on 5,000 random overlapping candidates', () => {
    const cands = [];
    for (let i = 0; i < 5000; i++) {
      const start = Math.floor(Math.random() * 20000);
      cands.push({ id: i, start, end: start + 1 + Math.floor(Math.random() * 12) });
      if (i % 50 === 0) cands.push({ id: -i, start, end: cands.at(-1).end }); // exact duplicate span
    }
    expect(detector.resolveOverlaps(cands)).toEqual(reference(cands));
  });

  it('handles 80,000 candidates in under 100 ms', () => {
    const cands = Array.from({ length: 80000 }, (_, i) => ({ start: i * 20, end: i * 20 + 10 }));
    const t0 = performance.now();
    detector.resolveOverlaps(cands);
    expect(performance.now() - t0).toBeLessThan(100);
  });
});
