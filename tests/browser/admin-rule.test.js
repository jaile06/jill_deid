// Admin rule form script (spec §3.3-6) on a copy of the form's fields: retention JSON, live RegExp test in the
// worker, and the stress run that catches backtracking the PHP blacklist misses.
import { describe, expect, it } from './runner.js';

const form = document.createElement('form');
form.id = 'jill-deid-rule-form';
form.action = 'javascript:void 0';
Object.assign(form.dataset, { msgNohit: 'NOHIT', msgSlow: 'SLOW', msgHits: 'HITS %s' });
form.innerHTML = `<input name="pattern"><input name="sample_text"><input type="hidden" name="retention" value='{"mode":"delim","delimiter":"#","side":"before"}'>
  <select name="ret_mode"><option>none</option><option>preview</option><option>ends</option><option>delim</option></select>
  <input name="ret_head" type="number"><input name="ret_tail" type="number"><input name="ret_delimiter">
  <select name="ret_side"><option>after</option><option>before</option></select><div data-ret="ends"></div>
  <div id="jill-deid-rule-test"></div>`;
document.body.append(form);
const field = (n) => form.elements.namedItem(n);
const out = () => document.getElementById('jill-deid-rule-test');
const until = async (ok, ms = 10000) => {
  for (const t0 = performance.now(); !ok(); await new Promise((r) => setTimeout(r, 50))) {
    if (performance.now() - t0 > ms) throw new Error(`timed out; output: ${out().textContent}`);
  }
};
const type = (name, value) => {
  field(name).value = value;
  field(name).dispatchEvent(new Event('input'));
};

describe('admin rule form', () => {
  it('reads the stored retention into the controls', async () => {
    await import('../../assets/js/jill/admin-rule.js');
    expect([field('ret_mode').value, field('ret_delimiter').value, field('ret_side').value]).toEqual(['delim', '#', 'before']);
  });

  it('writes the controls back as retention JSON', () => {
    field('ret_mode').value = 'ends';
    type('ret_head', '3');
    expect(JSON.parse(field('retention').value)).toEqual({ mode: 'ends', head: 3, tail: 0 });
    expect(form.querySelector('[data-ret="ends"]').hidden).toBe(false);
  });

  it('passes a rule-pack pattern and lists its hits', async () => {
    type('sample_text', '學號 115001');
    type('pattern', '(?<=學號[:：\\s]*)1\\d{5,6}(?!\\d)');
    await until(() => out().textContent.startsWith('HITS'));
    expect(out().textContent).toBe('HITS 115001');
  });

  it('refuses a pattern without hits', async () => {
    type('pattern', 'zzz');
    await until(() => out().textContent === 'NOHIT');
  });

  it('refuses a pattern that backtracks on large input, and blocks the submit', async () => {
    type('sample_text', '1234x');
    type('pattern', '\\d+\\d+\\d+\\d+x'); // no group, so the PHP blacklist lets it through
    await until(() => out().textContent === 'SLOW', 15000);
    const e = new Event('submit', { cancelable: true });
    form.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
  });
});
