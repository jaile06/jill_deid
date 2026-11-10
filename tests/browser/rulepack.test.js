// spec §9.3: the school rule pack (include/rule_pack.json) with the built-in rules, in the browser's RegExp
// (PCRE cannot run the unbounded lookbehinds), plus the reserved category list against upstream.
import { describe, expect, it } from './runner.js';
import { detect } from '../../assets/js/upstream/core/detector.js';
import { BUILTIN_PATTERNS } from '../../assets/js/upstream/core/patterns.js';
import { CATEGORIES } from '../../assets/js/upstream/core/types.js';

const pack = await (await fetch('../../include/rule_pack.json')).json();
const reserved = (await (await fetch('../../include/categories.json')).json()).reserved;
const rules = [...BUILTIN_PATTERNS, ...pack.map((r, i) => ({ id: `org-${i}`, name: r.title, category: r.category, regex: r.pattern, enabled: true }))];
const found = (text) => detect(text, rules).map((it) => `${it.category}:${it.original}`);

describe('rule pack', () => {
  const hits = {
    '學號 115001': '學號:115001',
    '學號：1150012': '學號:1150012',
    '座號 3': '座號:3',
    '座號：03': '座號:03',
    '員編 A200038': '員編:A200038',
    '教課（一）字第1141431254號': '文號:1141431254',
    '字第1140087197A號': '文號:1140087197A',
    '身分證 A123456789': '身分證:A123456789',
    '姓名 王小明': '姓名:王小明',
    '信箱 wang@school.edu.tw': '電子郵件:wang@school.edu.tw',
  };
  for (const [text, hit] of Object.entries(hits)) it(`hits ${text}`, () => expect(found(text)).toEqual([hit]));

  const misses = { '學費 150000 元': '', '座號 123': '座號', '學號 11500123': '學號', '身分證 A123456789': '員編' };
  for (const [text, category] of Object.entries(misses)) {
    it(`no ${category || 'hit'} in ${text}`, () => {
      const cats = found(text).map((f) => f.split(':')[0]);
      expect(category ? cats.includes(category) : cats.length > 0).toBe(false);
    });
  }

  it('school URL parameter stops at whitespace', () =>
    expect(found('連結 https://school.edu.tw/q?sid=112001 請查閱。\n第二段')).toEqual(['學號:112001']));
});

describe('categories.json', () => {
  it('reserves every upstream category and 網址', () => {
    for (const c of [...CATEGORIES, '網址']) expect(reserved).toContain(c);
  });
});
