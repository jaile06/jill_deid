// Admin rule form (spec §3.3-6): keeps the hidden retention JSON in step with its controls, and tests the RegExp
// in a worker before saving. The sample must match; stress inputs must each finish within 200 ms, since a quick
// small sample proves nothing about backtracking on a large file. Messages come from the form's data-* attributes.
import { validateRegex } from '../upstream/core/pattern-store.js';

const SLOW_MS = 200;
const KILL_MS = 2000; // worker start-up included; a run this long is slow by any measure

const form = document.getElementById('jill-deid-rule-form');
const field = (name) => form.elements.namedItem(name);
const out = document.getElementById('jill-deid-rule-test');

// Retention controls <-> hidden JSON
const retention = field('retention');
const ctl = Object.fromEntries(['mode', 'head', 'tail', 'delimiter', 'side'].map((k) => [k, field(`ret_${k}`)]));
const writeRetention = () => {
  const mode = ctl.mode.value;
  const r = mode === 'ends' ? { mode, head: Number(ctl.head.value) || 0, tail: Number(ctl.tail.value) || 0 }
    : mode === 'delim' ? { mode, delimiter: ctl.delimiter.value, side: ctl.side.value }
    : { mode };
  retention.value = JSON.stringify(r);
  for (const el of form.querySelectorAll('[data-ret]')) el.hidden = el.dataset.ret !== mode;
};
try {
  const r = JSON.parse(retention.value);
  ctl.mode.value = r.mode;
  if (r.mode === 'ends') [ctl.head.value, ctl.tail.value] = [r.head, r.tail];
  if (r.mode === 'delim') [ctl.delimiter.value, ctl.side.value] = [r.delimiter, r.side];
} catch {
  // unreadable stored value: the controls' defaults are written back below
}
for (const c of Object.values(ctl)) c.addEventListener('input', writeRetention);
writeRetention();

const run = (regex, text) => new Promise((resolve) => {
  const w = new Worker(new URL('./regex.worker.js', import.meta.url), { type: 'module' });
  const done = (v) => {
    clearTimeout(timer);
    w.terminate();
    resolve(v);
  };
  const timer = setTimeout(() => done(null), KILL_MS);
  w.onmessage = ({ data }) => done(data);
  w.onerror = () => done(null);
  w.postMessage({ regex, text });
});

const show = (text, ok) => {
  out.textContent = text;
  out.className = `small mt-1 ${ok ? 'text-success' : 'text-danger'}`;
  return ok;
};

let latest = 0;
let passed = false;
async function test() {
  const call = ++latest;
  passed = false;
  const pattern = field('pattern').value;
  const sample = field('sample_text').value;
  const invalid = validateRegex(pattern);
  if (invalid) return show(invalid, false);
  const r = await run(pattern, sample);
  if (call !== latest) return false;
  if (!r?.hits.length) return show(form.dataset.msgNohit, false);
  for (const s of [sample.repeat(500), `${'a'.repeat(5000)}!`, '1'.repeat(5000), ' '.repeat(5000)]) {
    const t = await run(pattern, s);
    if (call !== latest) return false;
    if (!t || t.ms > SLOW_MS) return show(form.dataset.msgSlow, false);
  }
  passed = show(form.dataset.msgHits.replace('%s', r.hits.map(([a, b]) => sample.slice(a, b)).join(' | ')), true);
  return passed;
}

let debounce;
for (const name of ['pattern', 'sample_text']) {
  field(name).addEventListener('input', () => {
    passed = false; // an edit is untested until the debounced run finishes
    clearTimeout(debounce);
    debounce = setTimeout(test, 300);
  });
}
if (field('pattern').value) test();

form.addEventListener('submit', async (e) => {
  if (passed) return;
  e.preventDefault();
  if (form.reportValidity() && (await test())) form.submit();
});
