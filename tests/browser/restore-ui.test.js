// Phase 4c: the restore page puts back link targets and link texts too (spec §5.3, H12 through the interface).
// A page of its own: the restore view keeps its document and table in module state.
import { describe, expect, it } from './runner.js';
import { parseDocument } from '../../assets/js/upstream/formats/index.js';
import { createRestoreView } from '../../assets/js/upstream/ui/restore-view.js';
import { deidentify } from './helpers.js';

const until = async (ok, ms = 30000) => {
  for (const t0 = performance.now(); !ok(); await new Promise((r) => setTimeout(r, 50))) {
    if (performance.now() - t0 > ms) throw new Error('timed out');
  }
};
const host = document.createElement('div');
host.id = 'jill-deid-app';
document.body.append(host);
host.append(createRestoreView());
const downloads = [];
HTMLAnchorElement.prototype.click = function click() {
  if (this.download) downloads.push({ name: this.download, blob: fetch(this.href).then((r) => r.blob()) });
};
const portal = () => document.getElementById('jill-deid-portal');
const toasts = () => [...portal().querySelectorAll('.toast')].map((t) => t.textContent).join('|');
const put = async (slot, file) => {
  const input = host.querySelectorAll('.restore-slot')[slot].querySelector('input[type="file"]');
  const dt = new DataTransfer();
  dt.items.add(file);
  input.files = dt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
};
const clearSlots = () => {
  for (const b of [...host.querySelectorAll('.file-chip button')]) b.click();
};
const fixture = async (name) => new File([await (await fetch(`fixtures/${name}`)).blob()], name);
const decoded = (doc) => (doc.links ?? []).map((l) => decodeURIComponent(l.uri));

describe('restore page with links (spec §5.3, H12)', () => {
  it('the upstream sample (載入體驗) still restores', async () => {
    [...host.querySelectorAll('button')].find((b) => b.textContent === '載入體驗').click();
    await until(() => host.querySelector('.restore-result'));
    const n = Number(host.querySelector('.restore-result .toolbar strong').textContent.match(/已還原 (\d+) 筆/)[1]);
    expect(n > 10).toBe(true);
    expect(host.querySelector('.restore-result .toolbar').textContent).not.toContain('無法還原');
    clearSlots();
    await until(() => !host.querySelector('.file-chip'));
  });

  it('a Word file: links listed as restored, the downloaded file equals the original', async () => {
    const original = await parseDocument(await fixture('links.docx'));
    const { out, csv } = await deidentify(await fixture('links.docx'));
    await put(0, out);
    await until(() => host.querySelector('.file-chip'));
    await put(1, new File([csv], 'links.mapping.csv'));
    await until(() => host.querySelector('.restore-result'));
    expect(host.querySelector('.restore-result .toolbar').textContent).not.toContain('無法還原');
    const list = host.querySelector('.restored-links').textContent;
    for (const u of ['mailto:wang.xm@school.edu.tw', 'name=王小明']) expect(list).toContain(u);
    expect(list).toContain('文字：聯絡王小明');
    downloads.length = 0;
    [...host.querySelectorAll('button')].find((b) => b.textContent === '下載還原文件').click();
    await until(() => downloads.length === 1);
    expect(downloads[0].name).toBe('links.restored.docx');
    const restored = await parseDocument(new File([await downloads[0].blob], 'links.restored.docx'));
    expect(restored.text).toBe(original.text);
    expect(decoded(restored)).toEqual(decoded(original));
  });

  it('a Markdown file whose only codes are in a link: no "no markers" warning, link restored byte for byte', async () => {
    clearSlots();
    const text = '[信箱](mailto:wang.xm@school.edu.tw)';
    const { out, csv } = await deidentify(new File([text], 'mail.md'));
    await put(0, out);
    await until(() => host.querySelector('.file-chip'));
    expect(toasts()).not.toContain('找不到編碼標記');
    await put(1, new File([csv], 'mail.mapping.csv'));
    await until(() => host.querySelector('.restore-result'));
    downloads.length = 0;
    [...host.querySelectorAll('button')].find((b) => b.textContent === '下載還原文件').click();
    await until(() => downloads.length === 1);
    expect(await (await downloads[0].blob).text()).toBe(text);
  });
});
