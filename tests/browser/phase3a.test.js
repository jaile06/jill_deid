// Phase 3a: column-header detection (spec §6.5, H22–H24) and detection in the worker (spec §3.3).
import { describe, expect, it } from './runner.js';
import { parseXlsx } from '../../assets/js/upstream/formats/xlsx.js';
import { parseDocx } from '../../assets/js/upstream/formats/docx.js';
import { detect, resolveOverlaps, toItems } from '../../assets/js/upstream/core/detector.js';
import { BUILTIN_PATTERNS } from '../../assets/js/upstream/core/patterns.js';
import { CodeBook } from '../../assets/js/upstream/core/codes.js';
import { columnCandidates } from '../../assets/js/jill/columns.js';
import { scanInWorker } from '../../assets/js/jill/detect.js';

const JSZip = globalThis.JSZip;
const S = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const LABELS = { 座號: '座號', 學號: '學號', 姓名: '姓名', 地址: '地址', 電話: '市話' };
const toFile = async (zip, name) => new File([await zip.generateAsync({ type: 'uint8array' })], name);
const found = (doc, cands) => cands.map((c) => `${c.category}:${doc.text.slice(c.start, c.end)}`);

/** rows of cells: a number is a numeric cell, a string a shared string */
async function xlsx(rows) {
  const strings = [];
  const ref = (r, c) => `${String.fromCharCode(65 + c)}${r + 1}`;
  const cells = rows.map((row, r) => `<row r="${r + 1}">${row.map((v, c) => {
    if (typeof v === 'number') return `<c r="${ref(r, c)}"><v>${v}</v></c>`;
    strings.push(v);
    return `<c r="${ref(r, c)}" t="s"><v>${strings.length - 1}</v></c>`;
  }).join('')}</row>`).join('');
  const z = new JSZip();
  z.file('xl/sharedStrings.xml', `<sst xmlns="${S}">${strings.map((s) => `<si><t>${s}</t></si>`).join('')}</sst>`);
  z.file('xl/worksheets/sheet1.xml', `<worksheet xmlns="${S}"><sheetData>${cells}</sheetData></worksheet>`);
  return parseXlsx(await toFile(z, 'r.xlsx'));
}

describe('columns (spec §6.5)', () => {
  it('H22 xlsx roster: numeric seat and student numbers, names off the surname list', async () => {
    const doc = await xlsx([['座號', '學號', '姓名', '成績'], [1, 115001, '武大郎', 90], [2, 1150012, '章志明', 85]]);
    expect(found(doc, columnCandidates(doc, LABELS))).toEqual(['座號:1', '座號:2', '學號:115001', '學號:1150012', '姓名:武大郎', '姓名:章志明']);
  });

  it('H23 Word table roster', async () => {
    const cell = (t) => `<w:tc><w:p><w:r><w:t>${t}</w:t></w:r></w:p></w:tc>`;
    const row = (...ts) => `<w:tr>${ts.map(cell).join('')}</w:tr>`;
    const z = new JSZip();
    z.file('word/document.xml', `<w:document xmlns:w="${W}"><w:body><w:p><w:r><w:t>名冊</w:t></w:r></w:p>`
      + `<w:tbl>${row('座號', '姓名')}${row('3', '尹美玲')}${row('4', '崔小英')}</w:tbl></w:body></w:document>`);
    const doc = await parseDocx(await toFile(z, 'r.docx'));
    expect(found(doc, columnCandidates(doc, LABELS))).toEqual(['座號:3', '座號:4', '姓名:尹美玲', '姓名:崔小英']);
  });

  it('H24 a vertical form (labels stacked in one column) gives no candidates', async () => {
    const doc = await xlsx([['姓名', '王小明'], ['地址', '台北市信義區市府路1號'], ['電話', '02-2720-8889']]);
    expect(columnCandidates(doc, LABELS)).toEqual([]);
  });

  it('labels match without spaces, colons or case, and carry the retention', async () => {
    const doc = await xlsx([['學 號：', 'EMAIL'], [115001, 'a@b.tw']]);
    const cands = columnCandidates(doc, { 學號: '學號', email: '電子郵件' }, (c) => (c === '學號' ? { mode: 'ends', head: 3, tail: 0 } : undefined));
    expect(found(doc, cands)).toEqual(['學號:115001', '電子郵件:a@b.tw']);
    expect(cands[0].retention).toEqual({ mode: 'ends', head: 3, tail: 0 });
  });

  it('a rule hit of the same span keeps the rule category (rule candidates first)', async () => {
    const doc = await xlsx([['電話'], ['0912-345-678']]);
    const ruleCands = detect(doc.text, BUILTIN_PATTERNS).map((i) => ({ category: i.category, start: i.start, end: i.end }));
    const merged = resolveOverlaps([...ruleCands, ...columnCandidates(doc, LABELS)]);
    expect(found(doc, merged)).toEqual(['手機:0912-345-678']);
  });
});

describe('worker detection (spec §3.3)', () => {
  const text = '聯絡人王小明，身分證 A123456789，手機 0912-345-678，信箱 wang@example.com，統一編號 04595257。';
  const rules = BUILTIN_PATTERNS.map((p) => ({ id: p.id }));

  it('finds what the main thread finds', async () => {
    const { cands, skipped } = await scanInWorker(text, rules);
    const viaWorker = toItems(text, resolveOverlaps(cands), new CodeBook()).map((i) => `${i.category}:${i.original}`);
    const direct = detect(text, BUILTIN_PATTERNS).map((i) => `${i.category}:${i.original}`);
    expect(skipped).toEqual([]);
    expect(viaWorker).toEqual(direct);
    expect(direct.length > 4).toBe(true);
  });

  it('skips a runaway rule after the watchdog and still runs the others', async () => {
    const t = `${'a'.repeat(40)} test@example.com`;
    const { cands, skipped } = await scanInWorker(t, [{ id: 'bad', category: '識別碼', regex: '(a+)+b' }, { id: 'email' }], 500);
    expect(skipped).toEqual(['bad']);
    expect(cands.map((c) => t.slice(c.start, c.end))).toEqual(['test@example.com']);
  });
});
