// Phase 3b-1: personal data in link targets (spec §5.1–§5.3, H1–H3, H10, H13, H17–H19, H26).
import { describe, expect, it } from './runner.js';
import { BUILTIN_PATTERNS, setPersonalHosts } from '../../assets/js/upstream/core/patterns.js';
import { CodeBook } from '../../assets/js/upstream/core/codes.js';
import { detect, resolveOverlaps, toItems, resplitItems } from '../../assets/js/upstream/core/detector.js';
import { applyRedactions } from '../../assets/js/upstream/core/redactor.js';
import { restore } from '../../assets/js/upstream/core/restorer.js';
import { brokenTextCandidates, restoreUri, scanUri } from '../../assets/js/jill/uri-scan.js';
import { scanInWorker } from '../../assets/js/jill/detect.js';

const HOSTS = ['facebook.com', 'line.me/ti/p', 'linkedin.com/in'];
setPersonalHosts(HOSTS);
const PARTIAL = { retentionOf: () => ({ mode: 'preview' }) }; // spec §9.2 default: 部分保留, code, mask_pii_in_url
const scan = (uri, opts = PARTIAL, patterns = BUILTIN_PATTERNS, book = new CodeBook()) => scanUri(uri, patterns, book, opts);
const C = '[0-9a-f]{6}';
const enc = (s) => encodeURIComponent(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const matches = (s, re) => expect(re.test(s) ? 'match' : s).toBe('match');
const roundTrip = (d) => restoreUri(d.uri, d.hits);

describe('link targets (spec §5.1)', () => {
  it('H1 mailto keeps the domain and the @', () => {
    const d = scan('mailto:wang.xm@school.edu.tw');
    matches(d.uri, new RegExp(`^mailto:${enc('[電子郵件:')}${C}${enc(']')}@school\\.edu\\.tw$`));
    expect(d.uri).not.toContain('wang.xm');
    expect(roundTrip(d).uri).toBe('mailto:wang.xm@school.edu.tw');
  });

  it('H2 tel keeps the carrier prefix', () => {
    const d = scan('tel:0912-345-678');
    matches(decodeURIComponent(d.uri), new RegExp(`^tel:0912-\\[手機:${C}\\]$`));
    expect(roundTrip(d).uri).toBe('tel:0912-345-678');
  });

  it('H3 query values, plain and percent-encoded', () => {
    const uri = 'https://school.edu.tw/s?id=A123456789&name=%E7%8E%8B%E5%B0%8F%E6%98%8E';
    const d = scan(uri);
    const out = decodeURIComponent(d.uri);
    matches(out, new RegExp(`^https://school\\.edu\\.tw/s\\?id=A1\\[身分證:${C}\\]&name=王\\[姓名:${C}\\]$`));
    for (const leak of ['A123456789', '%E5%B0%8F%E6%98%8E']) expect(d.uri).not.toContain(leak);
    expect(out).not.toContain('小明');
    expect(decodeURIComponent(roundTrip(d).uri)).toBe(decodeURIComponent(uri));
  });

  it('H10 a personal page is hidden raw after the site (no %2F)', () => {
    const d = scan('https://www.facebook.com/wang.xiaoming');
    matches(d.uri, new RegExp(`^https://www\\.facebook\\.com/${enc('[網址:')}${C}${enc(']')}$`));
    expect(roundTrip(d).uri).toBe('https://www.facebook.com/wang.xiaoming');
    const deep = scan('https://line.me/ti/p/abc123?x=1');
    expect(roundTrip(deep).uri).toBe('https://line.me/ti/p/abc123?x=1');
    expect(deep.uri).not.toContain('%2F');
    expect(scan('https://www.linkedin.com/company/acme').action).toBe('keep'); // pathPrefix /in only
  });

  it('H13 broken encoding: hidden whole as 網址, warned, restored byte for byte', () => {
    const uri = 'https://school.edu.tw/s?name=%E7%8E&x=1';
    const d = scan(uri);
    matches(d.uri, new RegExp(`\\?name=${enc('[網址:')}${C}${enc(']')}&x=1$`));
    expect(d.warnings).toEqual(['undecodable']);
    expect(roundTrip(d).uri).toBe(uri);
  });

  it('H17 an organisation rule with lookbehind on the key hits only that key', () => {
    const sid = { id: 'org-1', category: '學號', regex: '(?<=[?&](?:stu|sid|student_id)=)[^&#\\s]+', enabled: true, applyToUrl: true };
    const uri = 'https://school.edu.tw/q?sid=112001&other=112001';
    const d = scan(uri, {}, [sid]);
    matches(decodeURIComponent(d.uri), new RegExp(`\\?sid=\\[學號:${C}\\]&other=112001$`));
    expect(scan(uri, {}, [{ ...sid, applyToUrl: false }]).action).toBe('keep');
    expect(roundTrip(d).uri).toBe(uri);
  });

  it('H18 Big5 query value: no exception, hidden whole, warned', () => {
    const d = scan('https://school.edu.tw/q?name=%A4%FD%A4p%A9%FA');
    matches(d.uri, new RegExp(`\\?name=${enc('[網址:')}${C}${enc(']')}$`));
    expect(d.uri).not.toContain('%A4%FD');
    expect(d.warnings).toEqual(['undecodable']);
  });

  it('H19 personal data in the host strips the link and is flagged unrestorable', () => {
    const d = scan('http://192.168.1.10/x');
    expect(d.action).toBe('strip');
    expect(d.unrestorable).toBe(true);
    expect(d.warnings).toEqual(['host']);
  });

  it('untouched components keep their bytes; a link without hits is kept', () => {
    const d = scan('https://school.edu.tw/a%2Fb/s?x=%7e&id=A123456789#top');
    matches(d.uri, new RegExp(`^https://school\\.edu\\.tw/a%2Fb/s\\?x=%7e&id=A1${enc('[身分證:')}${C}${enc(']')}#top$`));
    expect(scan('https://school.edu.tw/about?page=2').action).toBe('keep');
  });

  it('a value shares its code with the same value in the text (one CodeBook)', () => {
    const book = new CodeBook();
    const [item] = detect('身分證 A123456789', BUILTIN_PATTERNS.filter((p) => p.id === 'tw-id'), book);
    const d = scanUri('https://x.tw/?id=A123456789', BUILTIN_PATTERNS, book, {});
    expect(d.hits[0].code).toBe(item.code);
  });

  it('strip_link and non-code markers remove a link with hits (spec §5.4)', () => {
    expect(scan('mailto:wang.xm@school.edu.tw', { ...PARTIAL, hyperlinkMode: 'strip_link' }).action).toBe('strip');
    const label = scan('mailto:wang.xm@school.edu.tw', { ...PARTIAL, markerStyle: 'label' });
    expect(label.action).toBe('strip');
    expect(label.warnings).toEqual(['marker']);
    expect(scan('https://school.edu.tw/', { ...PARTIAL, markerStyle: 'label' }).action).toBe('keep');
  });

  it('restoreUri reports codes missing from the table', () => {
    const d = scan('tel:0912-345-678');
    const r = restoreUri(d.uri, []);
    expect(r.uri).toBe(d.uri);
    expect(r.missingCodes).toEqual([d.hits[0].code]);
  });
});

describe('bare URLs in text (spec §5.2, §5.3)', () => {
  const url = BUILTIN_PATTERNS.filter((p) => p.id === 'url').map((p) => ({ ...p, retention: { mode: 'preview' } }));

  it('H26 a personal page in TXT: marker written unencoded, restored by the text restorer', () => {
    const text = '個人頁 https://www.facebook.com/wang.xiaoming。另見 https://school.edu.tw/x';
    const { redactedText, mapping } = applyRedactions(text, detect(text, url));
    matches(redactedText, new RegExp(`^個人頁 https://www\\.facebook\\.com/\\[網址:${C}\\]。另見 https://school\\.edu\\.tw/x$`));
    expect(restore(redactedText, mapping).restoredText).toBe(text);
  });

  it('the worker finds personal pages with the hosts of the page', async () => {
    const text = '見 https://m.facebook.com/wang.xiaoming';
    const { cands, skipped } = await scanInWorker(text, [{ id: 'url' }]);
    expect(skipped).toEqual([]);
    expect(cands.map((c) => text.slice(c.start, c.end))).toEqual(['https://m.facebook.com/wang.xiaoming']);
  });

  it('a percent-encoded name in a bare URL is hidden whole and never re-split', async () => {
    const text = '名單 https://school.edu.tw/s?name=%E7%8E%8B%E5%B0%8F%E6%98%8E&bad=%E7%8E 結束';
    const { cands } = await scanInWorker(text, [{ id: 'zh-name' }]);
    const book = new CodeBook();
    const items = toItems(text, resolveOverlaps([...cands, ...brokenTextCandidates(text)]), book);
    resplitItems(items, book, () => ({ mode: 'preview' })); // 部分保留 must not keep part of an encoded value
    const { redactedText, mapping } = applyRedactions(text, items);
    matches(redactedText, new RegExp(`\\?name=\\[姓名:${C}\\]&bad=\\[網址:${C}\\] 結束$`));
    expect(restore(redactedText, mapping).restoredText).toBe(text);
  });
});
