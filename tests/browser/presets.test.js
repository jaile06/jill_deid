// Presets and organisation rules in the interface (spec §3.4, §6.1 新增 1). A page of its own: the process view
// keeps its documents in module state, so this needs a fresh one.
import { describe, expect, it } from './runner.js';
import { CATEGORIES } from '../../assets/js/upstream/core/types.js';
import { setOrgPatterns } from '../../assets/js/upstream/core/pattern-store.js';
import { createProcessView, setPresets } from '../../assets/js/upstream/ui/process-view.js';

const until = async (ok, ms = 20000) => {
  for (const t0 = performance.now(); !ok(); await new Promise((r) => setTimeout(r, 50))) {
    if (performance.now() - t0 > ms) throw new Error('timed out');
  }
};

setOrgPatterns([{ id: 'org-1', name: '學號', category: '學號', regex: '(?<=學號[:：\\s]*)1\\d{5,6}(?!\\d)',
  retention: { mode: 'ends', head: 3, tail: 0 }, example: '學號 115001', applyToUrl: true, locked: false }]);
CATEGORIES.push('學號');
setPresets([
  { id: 1, title: '統計', description: '', keepStrategy: 'partial', markerStyle: 'code', hyperlinkMode: 'mask_pii_in_url', custom: {}, isDefault: true },
  { id: 2, title: '交外部', description: '', keepStrategy: 'custom', markerStyle: 'code', hyperlinkMode: 'mask_pii_in_url',
    custom: { 姓名: { mode: 'surname' }, 學號: { mode: 'none' } }, isDefault: false },
]);
const host = document.createElement('div');
host.id = 'jill-deid-app';
document.body.append(host);
host.append(createProcessView());
const preview = () => host.querySelector('.preview')?.textContent ?? '';

describe('presets and organisation rules', () => {
  it('detects with the organisation rule and the default preset (部分保留)', async () => {
    host.querySelector('textarea').value = '學號 115001，導師王小明。';
    [...host.querySelectorAll('button')].find((b) => b.textContent === '開始去識別化').click();
    await until(() => host.querySelectorAll('.mark').length >= 2);
    // organisation category keeps its rule's retention (115…), built-in 姓名 uses the standard split (王…)
    expect(preview()).toContain('115[學號]');
    expect(preview()).toContain('王[姓名]');
    expect(host.querySelector('#jill-deid-preset').value).toBe('1');
  });

  it('a custom preset overrides per category (姓名 keeps the surname, 學號 hidden)', async () => {
    const select = host.querySelector('#jill-deid-preset');
    select.value = '2';
    select.dispatchEvent(new Event('change'));
    await until(() => host.querySelector('#jill-deid-preset').value === '2');
    expect(preview()).toContain('王[姓名]');
    expect(preview()).toContain('[學號]');
    expect(preview()).not.toContain('115[學號]');
  });

  it('without a preset, 自訂 hides what nobody configured', async () => {
    const select = host.querySelector('#jill-deid-preset');
    select.value = '';
    select.dispatchEvent(new Event('change'));
    await until(() => host.querySelector('#jill-deid-preset').value === '');
    expect(preview()).toContain('[姓名]');
    expect(preview()).not.toContain('王[姓名]');
    expect(preview()).toContain('115[學號]'); // the organisation rule's retention still applies
  });
});
