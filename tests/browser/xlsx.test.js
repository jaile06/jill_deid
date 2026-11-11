// Phase 3b-4: XLSX link targets, HYPERLINK formulas, comments and residue (spec §5.5 XLSX, H8).
import { describe, expect, it } from './runner.js';
import { generateXlsx, parseXlsx } from '../../assets/js/upstream/formats/xlsx.js';
import { BUILTIN_PATTERNS } from '../../assets/js/upstream/core/patterns.js';
import { CodeBook } from '../../assets/js/upstream/core/codes.js';
import { resplitItems } from '../../assets/js/upstream/core/detector.js';
import { detectShort } from '../../assets/js/jill/detect.js';
import { applyRedactions } from '../../assets/js/upstream/core/redactor.js';
import { scanUri } from '../../assets/js/jill/uri-scan.js';
import { redactLinks } from '../../assets/js/jill/links/rels.js';
import { parseHyperlinkFormula } from '../../assets/js/jill/links/xlsx.js';
import { leaks } from './leak-check.js';

const JSZip = globalThis.JSZip;
const S = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PR = 'http://schemas.openxmlformats.org/package/2006/relationships';
const C = '[0-9a-f]{6}';
const PREVIEW = { mode: 'preview' };
const str = (ref, t) => `<c r="${ref}" t="inlineStr"><is><t>${t}</t></is></c>`;
const H8 = '<c r="B2" t="str"><f>HYPERLINK("mailto:wang.xm@school.edu.tw","王小明")</f><v>王小明</v></c>';
const rel = (id, target) => `<Relationship Id="${id}" Type="${R}/hyperlink" Target="${target}" TargetMode="External"/>`;
const matches = (s, re) => expect(re.test(s) ? 'match' : s).toBe('match');

async function file({ rows, hyperlinks = '', rels = '', files = {} }) {
  const z = new JSZip();
  z.file('xl/worksheets/sheet1.xml', `<worksheet xmlns="${S}" xmlns:r="${R}"><sheetData>${rows}</sheetData>${hyperlinks && `<hyperlinks>${hyperlinks}</hyperlinks>`}</worksheet>`);
  if (rels) z.file('xl/worksheets/_rels/sheet1.xml.rels', `<Relationships xmlns="${PR}">${rels}</Relationships>`);
  for (const [path, xml] of Object.entries(files)) z.file(path, xml);
  return new File([await z.generateAsync({ type: 'uint8array' })], 't.xlsx');
}

/** parse → detect (部分保留) → decide links as the processing page does → generate */
async function processXlsx(spec, { hyperlinkMode = 'mask_pii_in_url' } = {}) {
  const doc = await parseXlsx(spec instanceof File ? spec : await file(spec));
  const book = new CodeBook();
  const scan = (s) => {
    const items = detectShort(s, BUILTIN_PATTERNS, book); // as the page does for link texts
    resplitItems(items, book, () => PREVIEW);
    return applyRedactions(s, items);
  };
  const decide = (uri) => scanUri(uri, BUILTIN_PATTERNS, book, { retentionOf: () => PREVIEW, hyperlinkMode });
  const r = redactLinks(doc.links, scan(doc.text), 'code', decide, scan);
  const zip = await JSZip.loadAsync(await (await generateXlsx(doc, r.edits, r.links)).arrayBuffer());
  const read = (path) => zip.file(path).async('string');
  const sheet = async () => new DOMParser().parseFromString(await read('xl/worksheets/sheet1.xml'), 'application/xml');
  return { doc, r, zip, read, sheet };
}

describe('XLSX links (spec §5.5 XLSX 1–2)', () => {
  it('H8 HYPERLINK formula: <f> kept, URL and name de-identified, <v> follows', async () => {
    const { sheet, zip, r } = await processXlsx({ rows: `<row r="2">${H8}</row>` });
    const c = (await sheet()).getElementsByTagNameNS(S, 'c')[0];
    const f = c.getElementsByTagNameNS(S, 'f')[0]?.textContent ?? '(no f)';
    matches(f, new RegExp(`^HYPERLINK\\("mailto:%5B.+%5D@school\\.edu\\.tw","王\\[姓名:${C}\\]"\\)$`));
    matches(c.getElementsByTagNameNS(S, 'v')[0].textContent, new RegExp(`^王\\[姓名:${C}\\]$`));
    expect(c.getAttribute('t')).toBe('str');
    expect(await leaks(zip, ['wang.xm', '小明'])).toEqual([]);
    expect(r.mapping.map((m) => m.category).sort()).toEqual(['姓名', '電子郵件']);
  });

  it('a sheet hyperlink: target rewritten, display and tooltip scanned, display range is the cell', async () => {
    const { doc, sheet, read, zip } = await processXlsx({
      rows: `<row r="1">${str('A1', '王小明')}</row>`,
      hyperlinks: '<hyperlink ref="A1" r:id="rId1" display="王小明" tooltip="聯絡王小明"/>',
      rels: rel('rId1', 'https://school.edu.tw/s?id=A123456789'),
    });
    expect(doc.links.map((l) => [l.kind, doc.text.slice(...l.displayRange)])).toEqual([['rels', '王小明']]);
    const h = (await sheet()).getElementsByTagNameNS(S, 'hyperlink')[0];
    matches(h.getAttribute('display'), new RegExp(`^王\\[姓名:${C}\\]$`));
    matches(h.getAttribute('tooltip'), new RegExp(`^聯絡王\\[姓名:${C}\\]$`));
    matches(await read('xl/worksheets/_rels/sheet1.xml.rels'), /\?id=A1%5B/);
    expect(await leaks(zip, ['小明', 'A123456789'])).toEqual([]);
  });

  it('a display attribute holding the URL: its percent-encoded name is hidden too (spec §5.3)', async () => {
    const url = 'https://school.edu.tw/s?name=%E7%8E%8B%E5%B0%8F%E6%98%8E';
    const { zip, sheet } = await processXlsx({
      rows: `<row r="1">${str('A1', '名單')}</row>`,
      hyperlinks: `<hyperlink ref="A1" r:id="rId1" display="${url}"/>`,
      rels: rel('rId1', url),
    });
    matches((await sheet()).getElementsByTagNameNS(S, 'hyperlink')[0].getAttribute('display'), new RegExp(`\\?name=\\[姓名:${C}\\]$`));
    expect(await leaks(zip, ['小明'])).toEqual([]);
  });

  it('an internal hyperlink (location only): its texts are scanned', async () => {
    const { sheet, zip } = await processXlsx({
      rows: `<row r="1">${str('A1', '名冊')}</row>`,
      hyperlinks: '<hyperlink ref="A1" location="Sheet1!B9" display="王小明的資料"/>',
    });
    const h = (await sheet()).getElementsByTagNameNS(S, 'hyperlink')[0];
    expect(h.getAttribute('location')).toBe('Sheet1!B9');
    expect(await leaks(zip, ['小明'])).toEqual([]);
  });

  it('strip: hyperlinks go (with their empty container), a formula cell keeps only what it showed', async () => {
    const { sheet, read, zip } = await processXlsx({
      rows: `<row r="1">${str('A1', '信箱')}</row><row r="2">${H8}</row>`,
      hyperlinks: '<hyperlink ref="A1" r:id="rId1"/>',
      rels: rel('rId1', 'mailto:wang.xm@school.edu.tw'),
      files: { // a stripped formula would leave calcChain pointing at a cell without one: Excel calls that damaged
        'xl/calcChain.xml': `<calcChain xmlns="${S}"><c r="B2" i="1"/></calcChain>`,
        'xl/_rels/workbook.xml.rels': `<Relationships xmlns="${PR}"><Relationship Id="rId9" Type="${R}/calcChain" Target="calcChain.xml"/></Relationships>`,
        '[Content_Types].xml': '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/xl/calcChain.xml" ContentType="x"/></Types>',
      },
    }, { hyperlinkMode: 'strip_link' });
    expect(zip.file('xl/calcChain.xml')).toBe(null);
    expect(await read('xl/_rels/workbook.xml.rels')).not.toContain('calcChain');
    expect(await read('[Content_Types].xml')).not.toContain('calcChain');
    const out = await sheet();
    expect(out.getElementsByTagNameNS(S, 'hyperlinks').length).toBe(0);
    const c = out.getElementsByTagNameNS(S, 'c')[1];
    expect(c.getElementsByTagNameNS(S, 'f').length).toBe(0);
    expect(c.getAttribute('t')).toBe('inlineStr');
    matches(c.textContent, new RegExp(`^王\\[姓名:${C}\\]$`));
    expect(await read('xl/worksheets/_rels/sheet1.xml.rels')).not.toContain('Relationship ');
  });

  it('parseHyperlinkFormula: literals only, escaped quotes', () => {
    expect(parseHyperlinkFormula('HYPERLINK("https://x.tw/?q=""a""")').url).toBe('https://x.tw/?q="a"');
    expect(parseHyperlinkFormula('HYPERLINK("https://x.tw/",A2)').name).toBe(undefined);
    expect(parseHyperlinkFormula('HYPERLINK(A1,"x")')).toBe(null);
    expect(parseHyperlinkFormula('SUM(A1:A3)')).toBe(null);
  });

  it('a second download starts from the original again', async () => {
    const doc = await parseXlsx(await file({ rows: `<row r="1">${str('A1', '甲')}</row>`, hyperlinks: '<hyperlink ref="A1" r:id="rId1"/>', rels: rel('rId1', 'mailto:wang.xm@school.edu.tw') }));
    const d = (action) => [{ link: doc.links[0], decision: { action, hits: [], warnings: [], unrestorable: action === 'strip' } }];
    await generateXlsx(doc, [], d('strip'));
    const zip = await JSZip.loadAsync(await (await generateXlsx(doc, [], d('keep'))).arrayBuffer());
    expect(await zip.file('xl/worksheets/_rels/sheet1.xml.rels').async('string')).toContain('mailto:wang.xm@school.edu.tw');
    expect(await zip.file('xl/worksheets/sheet1.xml').async('string')).toContain('r:id="rId1"');
  });
});

describe('XLSX comments and residue (spec §5.5 XLSX 3–4)', () => {
  it('comment and threaded comment text scanned; authors, people and properties cleared', async () => {
    const TC = 'http://schemas.microsoft.com/office/spreadsheetml/2018/threadedcomments';
    const { doc, zip, read } = await processXlsx({
      rows: `<row r="1">${str('A1', '成績')}</row>`,
      files: {
        'xl/comments1.xml': `<comments xmlns="${S}"><authors><author>林志明</author></authors><commentList><comment ref="A1" authorId="0"><text><r><t>請王小明確認</t></r></text></comment></commentList></comments>`,
        'xl/threadedComments/threadedComment1.xml': `<ThreadedComments xmlns="${TC}"><threadedComment ref="A1" id="{1}" personId="{9}"><text>身分證 A123456789</text></threadedComment></ThreadedComments>`,
        'xl/persons/person.xml': `<personList xmlns="${TC}"><person displayName="陳美玲" id="{9}" userId="chen.ml@school.edu.tw" providerId="AD"/></personList>`,
        'docProps/core.xml': '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:creator>林志明</dc:creator></cp:coreProperties>',
      },
    });
    for (const s of ['王小明', 'A123456789']) expect(doc.text).toContain(s);
    expect(await leaks(zip, ['林志明', '小明', 'A123456789', '陳美玲', 'chen.ml'])).toEqual([]);
    expect(await read('xl/comments1.xml')).toContain('<author/>');
  });
});

describe('XLSX fixture made by Office, URLs rewritten (not stripped)', () => {
  it('links.xlsx (tools/make-links-xlsx.ps1): nothing remains in any form', async () => {
    const fixture = new File([await (await fetch('fixtures/links.xlsx')).blob()], 'links.xlsx');
    const { zip, r } = await processXlsx(fixture);
    expect(r.links.every((l) => l.decision.action !== 'strip')).toBe(true);
    expect(await leaks(zip, ['A123456789', '小明', 'wang.xm', 'chen.ml', '林志明', '測試作者'])).toEqual([]);
  });
});
