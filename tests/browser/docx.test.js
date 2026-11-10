// Phase 3b-3: DOCX link targets and residue (spec §5.5 DOCX, H4–H7, H16; H15 in h15.test.js).
import { describe, expect, it } from './runner.js';
import { generateDocx, parseDocx } from '../../assets/js/upstream/formats/docx.js';
import { BUILTIN_PATTERNS, setPersonalHosts } from '../../assets/js/upstream/core/patterns.js';
import { CodeBook } from '../../assets/js/upstream/core/codes.js';
import { resplitItems } from '../../assets/js/upstream/core/detector.js';
import { detectShort } from '../../assets/js/jill/detect.js';
import { applyRedactions } from '../../assets/js/upstream/core/redactor.js';
import { scanUri } from '../../assets/js/jill/uri-scan.js';
import { parseHyperlink } from '../../assets/js/jill/links/docx.js';
import { redactLinks } from '../../assets/js/jill/links/rels.js';
import { leaks } from './leak-check.js';

const JSZip = globalThis.JSZip;
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PR = 'http://schemas.openxmlformats.org/package/2006/relationships';
const HL = `${R}/hyperlink`;
const C = '[0-9a-f]{6}';
const H3 = 'https://school.edu.tw/s?id=A123456789&name=%E7%8E%8B%E5%B0%8F%E6%98%8E';
const esc = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
const run = (t) => `<w:r><w:t xml:space="preserve">${t}</w:t></w:r>`;
const p = (...inner) => `<w:p>${inner.join('')}</w:p>`;
const link = (id, t, extra = '') => `<w:hyperlink r:id="${id}"${extra}>${run(t)}</w:hyperlink>`;
const rel = (id, target) => `<Relationship Id="${id}" Type="${HL}" Target="${esc(target)}" TargetMode="External"/>`;
const fld = (type) => `<w:r><w:fldChar w:fldCharType="${type}"/></w:r>`;
const instr = (t) => `<w:r><w:instrText xml:space="preserve">${t}</w:instrText></w:r>`;
const field = (pieces, shown) => fld('begin') + pieces.map(instr).join('') + fld('separate') + run(shown) + fld('end');
const NS = `xmlns:w="${W}" xmlns:r="${R}"`;
const PREVIEW = { mode: 'preview' };

async function file({ body, rels = '', files = {} }) {
  const z = new JSZip();
  z.file('word/document.xml', `<w:document ${NS}><w:body>${body}</w:body></w:document>`);
  if (rels) z.file('word/_rels/document.xml.rels', `<Relationships xmlns="${PR}">${rels}</Relationships>`);
  for (const [path, xml] of Object.entries(files)) z.file(path, xml);
  return new File([await z.generateAsync({ type: 'uint8array' })], 't.docx');
}

/** parse → detect (部分保留) → decide links as the processing page does → generate; `tweak` edits the decisions */
async function processDocx(spec, { tweak, hyperlinkMode = 'mask_pii_in_url' } = {}) {
  const doc = await parseDocx(spec instanceof File ? spec : await file(spec));
  const book = new CodeBook();
  const scan = (s) => {
    const items = detectShort(s, BUILTIN_PATTERNS, book); // as the page does for link texts
    resplitItems(items, book, () => PREVIEW);
    return applyRedactions(s, items);
  };
  const decide = (uri) => scanUri(uri, BUILTIN_PATTERNS, book, { retentionOf: () => PREVIEW, hyperlinkMode });
  const r = redactLinks(doc.links, scan(doc.text), 'code', decide, scan);
  tweak?.(r.links);
  const zip = await JSZip.loadAsync(await (await generateDocx(doc, r.edits, r.links)).arrayBuffer());
  const read = (path) => zip.file(path).async('string');
  const xml = (s) => new DOMParser().parseFromString(s, 'application/xml');
  const text = async (path = 'word/document.xml') => [...xml(await read(path)).getElementsByTagNameNS(W, 't')].map((t) => t.textContent).join('');
  const rels = async (path = 'word/_rels/document.xml.rels') => [...xml(await read(path)).getElementsByTagNameNS(PR, 'Relationship')]
    .map((x) => [x.getAttribute('Id'), x.getAttribute('Target')]);
  return { doc, r, zip, read, text, rels, xml };
}
const matches = (s, re) => expect(re.test(s) ? 'match' : s).toBe('match');

describe('DOCX links (spec §5.5 DOCX 1–4)', () => {
  it('H4 display text unchanged, target rewritten', async () => {
    const { doc, text, rels, zip } = await processDocx({ body: p(link('rId1', '點此查看')), rels: rel('rId1', H3) });
    expect(doc.links.map((l) => [l.kind, doc.text.slice(...l.displayRange)])).toEqual([['rels', '點此查看']]);
    expect(await text()).toBe('點此查看');
    const [[id, target]] = await rels();
    expect(id).toBe('rId1');
    matches(decodeURIComponent(target), new RegExp(`\\?id=A1\\[身分證:${C}\\]&name=王\\[姓名:${C}\\]$`));
    expect(await leaks(zip, ['A123456789', '小明'])).toEqual([]);
  });

  it('H5 the same ID in the display text and the target gets one code', async () => {
    const { text, rels } = await processDocx({ body: p(link('rId1', 'A123456789')), rels: rel('rId1', 'https://x.tw/?id=A123456789') });
    const shown = (await text()).match(/\[身分證:([0-9a-f]{6})\]/)[1];
    expect(decodeURIComponent((await rels())[0][1])).toContain(`[身分證:${shown}]`);
  });

  it('H6 a HYPERLINK field code is rewritten', async () => {
    const { read, zip } = await processDocx({ body: p(field([' HYPERLINK "mailto:wang.xm@school.edu.tw" '], '寫信')) });
    matches(await read('word/document.xml'), /HYPERLINK "mailto:%5B.+%5D@school\.edu\.tw"/);
    expect(await leaks(zip, ['wang.xm'])).toEqual([]);
  });

  it('H16 a field code split over 3 instrText runs: written to the first, others emptied, tooltip scanned', async () => {
    const pieces = [' HYPERLINK "mailto:wang', '.xm@school.', 'edu.tw" \\o "聯絡王小明" '];
    const { doc, xml, read, zip } = await processDocx({ body: p(field(pieces, '寫信給導師')) });
    expect(doc.links.map((l) => [l.kind, l.uri, l.texts[0]?.value, doc.text.slice(...l.displayRange)])).toEqual([['field', 'mailto:wang.xm@school.edu.tw', '聯絡王小明', '寫信給導師']]);
    const nodes = [...xml(await read('word/document.xml')).getElementsByTagNameNS(W, 'instrText')].map((n) => n.textContent);
    expect(nodes.slice(1)).toEqual(['', '']);
    matches(nodes[0], new RegExp(`^ HYPERLINK "mailto:%5B.+%5D@school\\.edu\\.tw" \\\\o "聯絡王\\[姓名:${C}\\]" $`));
    expect(await leaks(zip, ['wang.xm', '小明'])).toEqual([]);
  });

  it('H7 two hyperlinks sharing an rId, one cancelled: a new rId, each correct', async () => {
    const target = 'mailto:wang.xm@school.edu.tw';
    const { xml, read, rels } = await processDocx(
      { body: p(link('rId1', '甲'), link('rId1', '乙')), rels: rel('rId1', target) },
      { tweak: (links) => { links[1].decision = { action: 'keep', hits: [], warnings: [], unrestorable: false }; } },
    );
    const refs = [...xml(await read('word/document.xml')).getElementsByTagNameNS(W, 'hyperlink')].map((h) => h.getAttributeNS(R, 'id'));
    const table = new Map(await rels());
    expect(refs[0]).toBe('rId1');
    expect(refs[1] === 'rId1' ? 'same rId' : 'new').toBe('new');
    expect(table.get(refs[1])).toBe(target);
    matches(table.get('rId1'), /^mailto:%5B.+%5D@school\.edu\.tw$/);
  });

  it('strip: a hyperlink keeps its text, its relationship goes; a field keeps its result', async () => {
    const { xml, read, rels, text } = await processDocx({
      body: p(link('rId1', '甲'), field([' HYPERLINK "mailto:wang.xm@school.edu.tw" '], '乙'), link('rId2', '丙')),
      rels: rel('rId1', 'mailto:wang.xm@school.edu.tw') + rel('rId2', 'https://school.edu.tw/'),
    }, { hyperlinkMode: 'strip_link' });
    const out = xml(await read('word/document.xml'));
    expect(await text()).toBe('甲乙丙');
    expect([...out.getElementsByTagNameNS(W, 'hyperlink')].map((h) => h.getAttributeNS(R, 'id'))).toEqual(['rId2']);
    expect(out.getElementsByTagNameNS(W, 'instrText').length).toBe(0);
    expect(out.getElementsByTagNameNS(W, 'fldChar').length).toBe(0);
    expect(await rels()).toEqual([['rId2', 'https://school.edu.tw/']]);
  });

  it('hyperlink tooltips, header links and drawing clicks', async () => {
    const header = `<w:hdr ${NS}>${p(link('rId1', '首頁'))}</w:hdr>`;
    const click = `<w:p><w:r><w:drawing><a:hlinkClick xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" r:id="rId2"/></w:drawing></w:r></w:p>`;
    const { read, zip, rels } = await processDocx({
      body: p(link('rId1', '說明', ' w:tooltip="聯絡人王小明"')) + click,
      rels: rel('rId1', 'https://school.edu.tw/') + rel('rId2', 'https://x.tw/?id=A123456789'),
      files: {
        'word/header1.xml': header,
        'word/_rels/header1.xml.rels': `<Relationships xmlns="${PR}">${rel('rId1', 'mailto:wang.xm@school.edu.tw')}</Relationships>`,
      },
    });
    matches(await read('word/document.xml'), new RegExp(`w:tooltip="聯絡人王\\[姓名:${C}\\]"`));
    matches((await rels())[1][1], /\?id=A1%5B/);
    matches((await rels('word/_rels/header1.xml.rels'))[0][1], /^mailto:%5B.+%5D@school\.edu\.tw$/);
    expect(await leaks(zip, ['小明', 'A123456789', 'wang.xm'])).toEqual([]);
  });

  it('a second download starts from the original again', async () => {
    const doc = await parseDocx(await file({ body: p(link('rId1', '甲')), rels: rel('rId1', 'mailto:wang.xm@school.edu.tw') }));
    const keep = [{ link: doc.links[0], decision: { action: 'keep', hits: [], warnings: [], unrestorable: false } }];
    const strip = [{ link: doc.links[0], decision: { action: 'strip', hits: [], warnings: [], unrestorable: true } }];
    await generateDocx(doc, [], strip);
    const zip = await JSZip.loadAsync(await (await generateDocx(doc, [], keep)).arrayBuffer());
    expect(await zip.file('word/_rels/document.xml.rels').async('string')).toContain('mailto:wang.xm@school.edu.tw');
    expect(await zip.file('word/document.xml').async('string')).toContain('r:id="rId1"');
  });

  it('parseHyperlink: switches, unquoted URLs, internal links', () => {
    expect(parseHyperlink(' HYPERLINK \\l "top" ')).toBe(null);
    expect(parseHyperlink('HYPERLINK https://x.tw/a \\o "t"').url.value).toBe('https://x.tw/a');
    expect(parseHyperlink('HYPERLINK "https://x.tw/" \\l "sec" \\t "_blank"').url.value).toBe('https://x.tw/');
    expect(parseHyperlink('MERGEFIELD 姓名')).toBe(null);
  });
});

describe('DOCX parts and residue (spec §5.5 DOCX 5–8)', () => {
  it('footnotes, endnotes and comments are scanned; reviewer names and properties cleared', async () => {
    const notes = (tag, inner) => `<w:${tag}s ${NS}><w:${tag} w:id="1">${p(run(inner))}</w:${tag}></w:${tag}s>`;
    const { doc, zip, read } = await processDocx({
      body: p(`<w:ins w:id="1" w:author="林志明" w:date="2026-01-01T00:00:00Z">${run('新增')}</w:ins>`),
      files: {
        'word/footnotes.xml': notes('footnote', '註：王小明'),
        'word/endnotes.xml': notes('endnote', '身分證 A123456789'),
        'word/comments.xml': `<w:comments ${NS}><w:comment w:id="0" w:author="林志明" w:initials="林">${p(run('請陳美玲確認'))}</w:comment></w:comments>`,
        'docProps/core.xml': '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:creator>林志明</dc:creator><cp:lastModifiedBy>林志明</cp:lastModifiedBy></cp:coreProperties>',
        'docProps/app.xml': '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Company>林志明工作室</Company><Manager>林志明</Manager></Properties>',
        'docProps/custom.xml': '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><property name="Owner" fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="2"><vt:lpwstr>林志明</vt:lpwstr></property></Properties>',
      },
    });
    for (const s of ['王小明', 'A123456789', '陳美玲']) expect(doc.text).toContain(s);
    expect(await leaks(zip, ['林志明', '王小明', 'A123456789', '陳美玲'])).toEqual([]);
    expect(await read('word/comments.xml')).toContain('w:initials=""');
    expect(await read('word/document.xml')).toContain('新增');
  });
});

describe('DOCX fixture made by Office, URLs rewritten (not stripped)', () => {
  it('links.docx (tools/make-links-docx.ps1): nothing remains in any form', async () => {
    setPersonalHosts(['facebook.com']);
    const fixture = new File([await (await fetch('fixtures/links.docx')).blob()], 'links.docx');
    const { zip, r } = await processDocx(fixture);
    expect(r.links.every((l) => l.decision.action !== 'strip')).toBe(true);
    expect(await leaks(zip, ['A123456789', '小明', 'wang.xm', 'wang.xiaoming', 'chen.ml', '林志明', '測試作者'])).toEqual([]);
  });
});
