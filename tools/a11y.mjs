// Accessibility checks of the module page (spec §9.4) for tools/e2e.mjs, run per tab in the themed page over CDP.
// axe-core is injected as source (no request from the page, so the HAR is untouched):
//   npm i --prefix tools --no-save --no-package-lock axe-core@4.10.2
// Dev tool; excluded from release.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AXE = join(dirname(fileURLToPath(import.meta.url)), 'node_modules', 'axe-core', 'axe.min.js');

// Runs in the page; returns problems as strings. Scope: the module's title and #jill-deid-app (the theme is not ours).
const CHECK = `(async () => {
  const app = document.getElementById('jill-deid-app');
  const out = [];
  const name = (e) => (e.getAttribute('aria-label') || e.textContent || e.title || e.value || '').trim().replace(/\\s+/g, ' ').slice(0, 40);
  // headings: none above h3, the module title first, never skipping a level
  const hs = [app.previousElementSibling, ...app.querySelectorAll('h1, h2, h3, h4, h5, h6')].filter((h) => h && /^H[1-6]$/.test(h.tagName));
  let prev = 2;
  for (const h of hs) {
    const l = +h.tagName[1];
    if (!h.checkVisibility()) continue; // hidden panels are checked on their own tab
    if (l < 3 || l > prev + 1) out.push('heading <' + h.tagName.toLowerCase() + '> after h' + prev + ': ' + name(h));
    prev = l;
  }
  // targets ≥ 44×44 (a checkbox or radio counts with its label; links inside running text are exempt, WCAG 2.5.5)
  for (const e of app.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, summary, [role=button], [tabindex]:not([tabindex="-1"])')) {
    if (!e.checkVisibility({ visibilityProperty: true })) continue;
    if (e.matches('a, .link-flag') && e.closest('p, li, td, .doc-para, .preview') && e.closest('p, li, td, .doc-para, .preview').textContent.trim() !== e.textContent.trim()) continue;
    const box = (e.matches('input[type=checkbox], input[type=radio], input[type=file]') && e.closest('label')) || e;
    const r = box.getBoundingClientRect();
    if (r.width && (r.width < 44 || r.height < 44)) out.push('target ' + Math.round(r.width) + '×' + Math.round(r.height) + ' <' + e.tagName.toLowerCase() + (e.className ? '.' + String(e.className).split(' ')[0] : '') + '> ' + name(e));
  }
  // preload: false, or axe refetches the theme's cross-origin stylesheets (the HAR check catches it)
  const res = await axe.run(app, { resultTypes: ['violations'], preload: false });
  for (const v of res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')) {
    for (const n of v.nodes) out.push('axe ' + v.impact + ' ' + v.id + ': ' + n.target.join(' ') + ' ' + (n.failureSummary || '').split('\\n')[1]?.trim());
  }
  return out;
})()`;

// Keyboard: every visible control of the app is numbered; Tab from the first must reach each one, with a visible
// focus indicator, and leave the app at the end (no trap).
const NUMBER = `(() => {
  const app = document.getElementById('jill-deid-app');
  const all = [...app.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, summary, [tabindex]')]
    .filter((e) => !e.disabled && e.tabIndex >= 0 && !e.closest('[inert]') && e.checkVisibility({ visibilityProperty: true }));
  all.forEach((e, i) => e.setAttribute('data-kb', i));
  all[0].focus();
  return all.length;
})()`;
const FOCUSED = `(async () => {
  const e = document.activeElement;
  // a theme transition (xbootstrap5: a { transition: .2s }) grows the ring after focus; read it once it is drawn
  const wait = Math.max(0, ...getComputedStyle(e).transitionDuration.split(',').map((d) => parseFloat(d) * (d.includes('ms') ? 1 : 1000)));
  if (wait) await new Promise((r) => setTimeout(r, wait + 50));
  const box = e.closest('label') && e.matches('input[type=checkbox], input[type=radio], input[type=file]') ? e.closest('label') : e;
  const s = getComputedStyle(e);
  const b = getComputedStyle(box, null);
  const ring = (x) => (x.outlineStyle !== 'none' && parseFloat(x.outlineWidth) > 0) || x.boxShadow !== 'none';
  const label = (e.getAttribute('aria-label') || e.textContent || e.title || e.name || '').trim().replace(/\\s+/g, ' ').slice(0, 40);
  return { kb: e.getAttribute('data-kb'), inApp: !!e.closest('#jill-deid-app'), ring: ring(s) || ring(b) || e.matches(':focus-within') && ring(getComputedStyle(e.parentElement)),
    what: '<' + e.tagName.toLowerCase() + (e.className ? '.' + String(e.className).split(' ')[0] : '') + '> ' + label };
})()`;
const KEY = { Tab: { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 }, Enter: { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' } };
async function press(send, k) {
  await send('Input.dispatchKeyEvent', { type: 'keyDown', ...KEY[k] });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', ...KEY[k], text: undefined });
}

async function checkKeyboard(evaluate, send) {
  const n = await evaluate(NUMBER);
  const seen = new Set();
  const out = [];
  for (let i = 0; i < n + 5; i++) {
    const f = await evaluate(FOCUSED);
    if (!f.inApp) break;
    if (f.kb !== null) seen.add(f.kb);
    if (!f.ring) out.push(`no focus indicator ${f.what}`);
    await press(send, 'Tab');
  }
  if ((await evaluate(FOCUSED)).inApp) out.push('focus trapped in the app (Tab never leaves it)');
  // an unchecked radio is reached with the arrow keys from its group's checked one (browser standard)
  const missed = await evaluate(`[...document.querySelectorAll('#jill-deid-app [data-kb]')].filter((e) => !${JSON.stringify([...seen])}.includes(e.getAttribute('data-kb')))
    .filter((e) => !(e.matches('input[type=radio]:not(:checked)') && document.querySelector('input[type=radio][name="' + e.name + '"]:checked')))
    .map((e) => '<' + e.tagName.toLowerCase() + (e.className ? '.' + String(e.className).split(' ')[0] : '') + '> ' + (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 40))`);
  out.push(...missed.map((m) => `not reachable by Tab ${m}`));
  await evaluate(`document.querySelectorAll('#jill-deid-app [data-kb]').forEach((e) => e.removeAttribute('data-kb'))`);
  return [...new Set(out)];
}

/**
 * Checks every tab of the page, switching tabs with the keyboard (focus + Enter); leaves the first tab shown.
 * `send` is the CDP command function (Input.dispatchKeyEvent). Returns problems prefixed with the tab.
 */
export async function checkA11y(evaluate, send) {
  if (!existsSync(AXE)) return [`axe-core missing: npm i --prefix tools --no-save --no-package-lock axe-core@4.10.2`];
  await evaluate(readFileSync(AXE, 'utf8'));
  await send('Emulation.setFocusEmulationEnabled', { enabled: true }); // headless pages lack focus: no :focus-visible
  const tabs = await evaluate(`[...document.querySelectorAll('#jill-deid-app .tabs button.tab')].map((b) => b.dataset.tab)`);
  const problems = [];
  const open = async (t) => {
    await evaluate(`document.querySelector('#jill-deid-app .tabs [data-tab="${t}"]').focus()`);
    await press(send, 'Enter');
    await new Promise((r) => setTimeout(r, 500));
    return evaluate(`document.querySelector('#jill-deid-app .tabs [data-tab="${t}"]').classList.contains('active')`);
  };
  for (const t of tabs) {
    if (!(await open(t))) problems.push(`${t}: Enter on the tab button does not open it`);
    // closed <details> hide their content; open them all so it is checked too, then put them back
    await evaluate(`window.__kbClosed = [...document.querySelectorAll('#jill-deid-app details:not([open])')]; __kbClosed.forEach((d) => { d.open = true; })`);
    await new Promise((r) => setTimeout(r, 300));
    problems.push(...(await evaluate(CHECK)).map((p) => `${t}: ${p}`));
    problems.push(...(await checkKeyboard(evaluate, send)).map((p) => `${t}: keyboard: ${p}`));
    await evaluate(`__kbClosed.forEach((d) => { d.open = false; })`);
  }
  await open(tabs[0]);
  return [...new Set(problems)];
}
