// Phase 3b-1: personal data in link targets (spec §5.1–§5.3, H1–H3, H10, H13, H17–H19, H26).
import { describe, expect, it } from './runner.js';
import { BUILTIN_PATTERNS } from '../../assets/js/upstream/core/patterns.js';
import { CodeBook } from '../../assets/js/upstream/core/codes.js';
import { detect, resolveOverlaps, toItems, resplitItems } from '../../assets/js/upstream/core/detector.js';
import { applyRedactions } from '../../assets/js/upstream/core/redactor.js';
import { restore } from '../../assets/js/upstream/core/restorer.js';
import { brokenTextCandidates, restoreUri, scanUri } from '../../assets/js/jill/uri-scan.js';
import { scanInWorker } from '../../assets/js/jill/detect.js';

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

  it('H10 a network or an IP with its port is hidden whole (rule 16 ip-net); an IP host removes the link', () => {
    const d = scan('https://school.edu.tw/log?net=192.168.1.0%2F24&at=10.0.0.1%3A8080');
    matches(d.uri, new RegExp(`\\?net=192\\.168\\.${enc('[IP:')}${C}${enc(']')}&at=10\\.0\\.${enc('[IP:')}${C}${enc(']')}$`));
    expect(d.hits.map((h) => h.original)).toEqual(['1.0/24', '0.1:8080']);
    expect(roundTrip(d).uri).toBe('https://school.edu.tw/log?net=192.168.1.0%2F24&at=10.0.0.1%3A8080');
    expect(scan('http://10.0.0.1:8080/s').action).toBe('strip');
    expect(scan('https://www.facebook.com/wang.xiaoming').action).toBe('keep'); // no personal-page rule (spec §5.2)
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
  const none = (ids) => BUILTIN_PATTERNS.filter((p) => ids.includes(p.id)).map((p) => ({ ...p, retention: { mode: 'none' } }));

  it('H26 rule 16 in TXT: networks and ports hidden whole, not left as「/24」「:8080」; restored exactly', () => {
    const text = '主機 http://10.0.0.1:8080/s，網段 192.168.1.0/24，IPv6 2001:db8::/32 與 [2001:db8::1]:443。時間 10:30:00/24 不算';
    const { redactedText, mapping } = applyRedactions(text, detect(text, none(['ipv4', 'ipv6', 'ip-net'])));
    matches(redactedText, new RegExp(`^主機 http://\\[IP:${C}\\]/s，網段 \\[IP:${C}\\]，IPv6 \\[IP:${C}\\] 與 \\[IP:${C}\\]。時間 10:30:00/24 不算$`));
    expect(mapping.map((m) => m.original)).toEqual(['10.0.0.1:8080', '192.168.1.0/24', '2001:db8::/32', '[2001:db8::1]:443']);
    expect(restore(redactedText, mapping).restoredText).toBe(text);
    expect(detect('版本 1.2.3.4/50、埠 10.0.0.1:70000', none(['ip-net']))).toEqual([]);
  });

  it('the worker runs rule 16 with its validator', async () => {
    const text = '見 [2001:db8::1]:443 與 10:30:00/24';
    const { cands, skipped } = await scanInWorker(text, [{ id: 'ip-net' }]);
    expect(skipped).toEqual([]);
    expect(cands.map((c) => text.slice(c.start, c.end))).toEqual(['[2001:db8::1]:443']);
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
