// Phase 4a: links and item sources on the processing page (spec §5.4, §6.1 新增 2, 3, 7; H4, H11 UI parts).
// A page of its own: the process view keeps its documents in module state.
import { describe, expect, it } from './runner.js';
import { CATEGORIES } from '../../assets/js/upstream/core/types.js';
import { createProcessView } from '../../assets/js/upstream/ui/process-view.js';
import { config } from '../../assets/js/jill/config.js';

const until = async (ok, ms = 30000) => {
  for (const t0 = performance.now(); !ok(); await new Promise((r) => setTimeout(r, 50))) {
    if (performance.now() - t0 > ms) throw new Error('timed out');
  }
};
// as main.js does
for (const c of Object.values(config.columnLabels)) if (!CATEGORIES.includes(c)) CATEGORIES.push(c);
const host = document.createElement('div');
host.id = 'jill-deid-app';
document.body.append(host);
host.append(createProcessView());
const $ = (s) => host.querySelector(s);
const buttonNamed = (text, root = host) => [...root.querySelectorAll('button')].find((b) => b.textContent.trim() === text);
const portal = () => document.getElementById('jill-deid-portal');
const popup = () => portal().querySelector('.link-popup');
const flags = () => [...host.querySelectorAll('.preview .link-flag')];

describe('links on the processing page (spec §6.1 新增 2, 3)', () => {
  it('H4: a 🔗 button after the text of a link with personal data, none after a plain link', async () => {
    // both documents at once through the drop zone's input; the first (links.md) becomes the active one
    const md = new File(['請看[點此查看](https://school.edu.tw/s?id=A123456789)與[學校首頁](https://school.edu.tw/)。'], 'links.md');
    const roster = new File([await (await fetch('fixtures/roster.xlsx')).blob()], 'roster.xlsx');
    const dt = new DataTransfer();
    dt.items.add(md);
    dt.items.add(roster);
    const input = host.querySelector('.dropzone input[type="file"]');
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await until(() => flags().length > 0);
    expect(flags().length).toBe(1);
    expect(flags()[0].querySelector('.visually-hidden').textContent).toBe('這個連結含個資：檢視與處理'); // P1-16
    expect(flags()[0].previousSibling.textContent.endsWith('點此查看')).toBe(true);
    expect($('[data-row="links"]') ? 'row' : 'none').toBe('row');
  });

  it('the popup compares before and after; Esc closes it and gives focus back', async () => {
    flags()[0].click();
    expect(popup().textContent).toContain('https://school.edu.tw/s?id=A123456789');
    expect(popup().textContent).toContain('?id=A1[身分證:');
    popup().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(popup()).toBe(null);
    expect(document.activeElement).toBe(flags()[0]);
  });

  it('移除連結 and 恢復自動處理 on one link', async () => {
    flags()[0].click();
    buttonNamed('移除連結', popup()).click();
    await until(() => flags().length === 1 && !popup());
    flags()[0].click();
    expect(popup().textContent).toContain('（移除連結，只留文字）');
    expect(popup().textContent).toContain('你選擇移除這個連結');
    buttonNamed('恢復自動處理', popup()).click();
    await until(() => !popup());
    flags()[0].click();
    expect(popup().textContent).toContain('?id=A1[身分證:');
    buttonNamed('關閉', popup()).click();
  });

  it('H11: a label marker removes such links, and the page says so', async () => {
    [...host.querySelectorAll('input[name="marker-style"]')].find((r) => r.value === 'label').click();
    await until(() => host.querySelector('.output-notice')?.textContent.includes('含個資的連結會移除'));
    flags()[0].click();
    expect(popup().textContent).toContain('（移除連結，只留文字）');
    expect(popup().textContent).toContain('網址放不下可還原的標記');
    buttonNamed('關閉', popup()).click();
    [...host.querySelectorAll('input[name="marker-style"]')].find((r) => r.value === 'code').click();
    await until(() => !host.querySelector('.output-notice')?.textContent.includes('含個資的連結會移除'));
  });
});

describe('item sources and whole columns (spec §6.1 新增 7)', () => {
  it('a roster: column items are tagged with their header and cancelled as a column; properties row shown', async () => {
    [...host.querySelectorAll('.file-item')].find((f) => f.textContent.includes('roster.xlsx')).querySelector('.file-item-main').click();
    await until(() => [...host.querySelectorAll('button')].some((b) => b.textContent.includes('展開偵測清單')) && host.querySelector('[data-row="props"]'));
    [...host.querySelectorAll('button')].find((b) => b.textContent.includes('展開偵測清單')).click();
    await until(() => host.querySelector('.column-batch'));
    const tags = [...host.querySelectorAll('.sidebar .tag')].map((t) => t.textContent);
    expect(tags).toContain('欄首「學號」');
    expect(tags).toContain('規則');
    const row = () => [...host.querySelectorAll('.column-batch .add-popup-row')].find((r) => r.textContent.includes('欄首「學號」'));
    const before = row().textContent;
    buttonNamed('整欄取消', row()).click();
    await until(() => row().textContent.includes('生效 0 /'));
    expect(before.includes('生效 0 /')).toBe(false);
    buttonNamed('整欄加回', row()).click();
    await until(() => !row().textContent.includes('生效 0 /'));
  });
});

// Downloads go through <a download>.click() (components.js downloadBlob): record name and content instead.
const downloads = [];
HTMLAnchorElement.prototype.click = function click() {
  if (this.download) downloads.push({ name: this.download, text: fetch(this.href).then((r) => r.text()) });
};
const show = (name) => [...host.querySelectorAll('.file-item')].find((f) => f.textContent.includes(name)).querySelector('.file-item-main').click();
const menuItem = (text) => {
  host.querySelector('details.menu').open = true;
  [...host.querySelectorAll('.menu-item')].find((b) => b.textContent.trim() === text).click();
};
const lastDownload = async (n = 1) => {
  await until(() => downloads.length >= n);
  return downloads.at(-1);
};

describe('upstream functions on the themed page (spec §6.1 上游功能 1–11)', () => {
  it('9: the downloaded document follows the link choice (auto, then 取消去識別化)', async () => {
    show('links.md');
    await until(() => flags().length === 1);
    downloads.length = 0;
    menuItem('只下載去識別化文件');
    const auto = await lastDownload();
    expect(auto.name).toBe('links.deid.md');
    expect(await auto.text).toContain('?id=A1%5B');
    flags()[0].click();
    buttonNamed('取消去識別化', popup()).click();
    await until(() => !popup());
    menuItem('只下載去識別化文件');
    const kept = await lastDownload(2);
    expect(await kept.text).toContain('?id=A123456789');
    flags()[0].click();
    buttonNamed('恢復自動處理', popup()).click();
    await until(() => !popup());
  });

  it('9, 10: one file with its table, then everything; the leave-page warning follows', async () => {
    const { hasUnsavedResults } = await import('../../assets/js/upstream/ui/process-view.js');
    downloads.length = 0;
    menuItem('下載此檔（文件＋編碼表）');
    await until(() => downloads.length >= 2);
    expect(downloads.map((x) => x.name)).toEqual(['links.deid.md', 'links.mapping.csv']);
    expect(await downloads[1].text).toContain('身分證');
    expect(hasUnsavedResults()).toBe(true); // the roster is not downloaded yet
    buttonNamed('打包下載全部（2 個檔案）').click();
    await until(() => downloads.length >= 3);
    expect(downloads[2].name.startsWith('去識別化-') && downloads[2].name.endsWith('.zip')).toBe(true);
    await until(() => !hasUnsavedResults());
  });

  it('11: the format limitations of the shown file', async () => {
    show('roster.xlsx');
    await until(() => host.querySelector('.status-info')?.dataset.tip.includes('Excel'));
    expect(host.querySelector('.status-info').dataset.tip).toContain('超連結（含 HYPERLINK 公式）');
  });

  it('6: plain view, and a selection becomes a new item', async () => {
    show('links.md');
    const count = () => Number(host.querySelector('.sidebar h4').textContent.match(/共 (\d+)/)[1]);
    await until(() => host.querySelector('.sidebar h4'));
    const before = count();
    const plain = [...host.querySelectorAll('.preview-head-tools input[type="checkbox"]')][0];
    if (plain) { // a Markdown file has no layout: the preview is plain already
      plain.click();
      await until(() => host.querySelector('.preview-plain'));
    }
    const span = [...host.querySelectorAll('.preview [data-plain]')].find((s) => s.textContent.includes('學校首頁'));
    const node = span.firstChild;
    const at = node.textContent.indexOf('學校首頁');
    const range = document.createRange();
    range.setStart(node, at);
    range.setEnd(node, at + 4);
    getSelection().removeAllRanges();
    getSelection().addRange(range);
    host.querySelector('.preview').dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    await until(() => buttonNamed('新增為去識別化項目', portal()));
    buttonNamed('新增為去識別化項目', portal()).click();
    await until(() => count() === before + 1);
    expect([...host.querySelectorAll('.sidebar .tag')].map((t) => t.textContent)).toContain('手動');
  });

  it('5, 7: a whole category off and on again; 重新偵測 keeps manual items', async () => {
    const active = () => Number(host.querySelector('.sidebar h4').textContent.match(/生效 (\d+)/)[1]);
    const total = () => Number(host.querySelector('.sidebar h4').textContent.match(/共 (\d+)/)[1]);
    const before = active();
    const box = () => [...host.querySelectorAll('.output-table tr')].find((tr) => tr.querySelector('.badge')?.textContent === '姓名').querySelector('input[type="checkbox"]');
    box().click();
    await until(() => active() < before);
    box().click();
    await until(() => active() === before);
    const n = total();
    buttonNamed('重新偵測').click();
    await until(() => [...host.querySelectorAll('#jill-deid-portal .toast')].some((t) => t.textContent.includes('重新偵測')) || total() === n, 15000);
    await until(() => host.querySelector('.sidebar h4') && total() === n);
    expect([...host.querySelectorAll('.sidebar .tag')].map((t) => t.textContent)).toContain('手動');
  });

  it('8: shared codes across files offer a merged table', async () => {
    host.querySelector('.output-panel').open = true;
    const shared = [...host.querySelectorAll('.code-advanced input[type="checkbox"], .output-panel input[type="checkbox"]')]
      .find((i) => i.closest('label')?.textContent.includes('共用'));
    shared.click();
    await until(() => [...host.querySelectorAll('.menu-item')].some((b) => b.textContent.includes('下載合併編碼表')));
  });
});
