// Phase 4b: the rules page — organisation rules and 測試網址 (spec §6.1 新增 4, §9.3 第 4 項).
import { describe, expect, it } from './runner.js';
import { CATEGORIES } from '../../assets/js/upstream/core/types.js';
import { STORAGE_KEY, getEffectivePatterns, setOrgPatterns } from '../../assets/js/upstream/core/pattern-store.js';
import { createPatternsView } from '../../assets/js/upstream/ui/patterns-view.js';

localStorage.removeItem(STORAGE_KEY); // the runner reuses one browser profile for every page
const ORG = [
  // as Config::toJson() gives them; the first is the rule pack's 校務網址參數 (locked here), the second skips URLs
  { id: 'org-1', name: '校務網址參數', category: '學號', regex: '(?<=[?&](?:stu|sid|student_id)=)[^&#\\s]+', applyToUrl: true, retention: { mode: 'none' }, example: '?sid=112001', locked: true },
  { id: 'org-2', name: '座號參數', category: '座號', regex: '(?<=[?&]seat=)\\d{1,2}(?!\\d)', applyToUrl: false, retention: { mode: 'none' }, example: '?seat=12', locked: false },
];
for (const r of ORG) if (!CATEGORIES.includes(r.category)) CATEGORIES.push(r.category);
setOrgPatterns(ORG);
const host = document.createElement('div');
host.id = 'jill-deid-app';
document.body.append(host);
let view = createPatternsView();
host.append(view);
const group = () => view.querySelector('[data-group="org"]');
const toggleOf = (id) => view.querySelector(`.rule-row[data-id="${id}"] .rule-toggle`);
const test = (url) => {
  const input = view.querySelector('.url-test-input');
  input.value = url;
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
  return view.querySelector('.url-test-result');
};

describe('機構共用規則 (spec §6.1 新增 4)', () => {
  it('listed in their own group; a locked rule cannot be switched off', () => {
    expect(group().querySelector('.rule-group-title').textContent).toBe('機構共用規則（2）');
    expect(toggleOf('org-1').disabled).toBe(true);
    expect(toggleOf('org-2').disabled).toBe(false);
  });

  it('an unlocked rule can be switched off, and back on, in this browser', () => {
    toggleOf('org-2').click();
    expect(getEffectivePatterns().find((p) => p.id === 'org-2').enabled).toBe(false);
    toggleOf('org-2').click();
    expect(getEffectivePatterns().find((p) => p.id === 'org-2').enabled).toBe(true);
  });

  it('全部啟用 off leaves the locked rule on', () => {
    const all = group().querySelector('.group-toggle');
    all.click(); // was all on: turns the group off
    const state = Object.fromEntries(getEffectivePatterns().filter((p) => p.source === 'org').map((p) => [p.id, p.enabled]));
    expect(state).toEqual({ 'org-1': true, 'org-2': false });
    group().querySelector('.group-toggle').click();
  });

  it('the details say where the rule comes from and whether it checks URLs', () => {
    [...view.querySelectorAll('.rule-row[data-id="org-2"] button')].find((b) => b.textContent === '查看規則').click();
    const detail = view.querySelector('.rule-row[data-id="org-2"]').nextElementSibling.textContent;
    expect(detail).toContain('機構共用（管理者設定，唯讀）');
    expect(detail).toContain('不檢查超連結網址');
  });

  it('no organisation rules: no empty group', () => {
    setOrgPatterns([]);
    const bare = createPatternsView();
    expect(bare.querySelector('[data-group="org"]')).toBe(null);
    setOrgPatterns(ORG);
    view.replaceWith((view = createPatternsView()));
  });
});

describe('測試網址 (spec §6.1 新增 4, §9.3 第 4 項)', () => {
  it('apply_to_url = 1: ?sid=112001 is caught, only the value; ?other= is not', () => {
    const out = test('https://school.edu.tw/q?sid=112001&other=112001');
    const rows = [...out.querySelectorAll('tbody tr')].map((tr) => [...tr.children].map((td) => td.textContent.trim()));
    expect(rows.find((r) => r[1] === 'sid=112001')).toEqual(['參數', 'sid=112001', '112001', '學號 112001']);
    expect(rows.find((r) => r[1] === '112001' || r[1] === 'other=112001')?.[3] ?? '').toBe('');
    expect(out.querySelector('.url-test-output').textContent).toContain('?sid=[學號:');
    expect(out.querySelector('.url-test-output').textContent).toContain('&other=112001');
  });

  it('apply_to_url = 0: the rule leaves URLs alone', () => {
    const out = test('https://school.edu.tw/q?seat=12');
    expect(out.querySelector('.url-test-hit')).toBe(null);
    expect(out.querySelector('.url-test-output').textContent).toBe('（沒有命中，原樣保留）');
  });

  it('decoded parts, built-in rules, an undecodable value', () => {
    const out = test('https://school.edu.tw/s?name=%E7%8E%8B%E5%B0%8F%E6%98%8E&old=%A4%FD');
    const text = out.textContent;
    expect(text).toContain('王小明');
    expect(text).toContain('（無法解碼，會整段隱藏）');
    expect(out.querySelector('.url-test-output').textContent).toContain('[網址:');
  });

  it('a personal page matches as a whole', () => {
    setOrgPatterns(ORG);
    const out = test('mailto:wang.xm@school.edu.tw');
    expect([...out.querySelectorAll('tbody tr td')].map((td) => td.textContent)).toContain('收件者');
    expect(out.textContent).toContain('電子郵件 wang.xm@school.edu.tw');
  });
});
