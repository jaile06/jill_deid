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
    if (h.offsetParent === null) continue; // hidden panels are checked on their own tab
    if (l < 3 || l > prev + 1) out.push('heading <' + h.tagName.toLowerCase() + '> after h' + prev + ': ' + name(h));
    prev = l;
  }
  // targets ≥ 44×44 (a checkbox or radio counts with its label; links inside running text are exempt, WCAG 2.5.5)
  for (const e of app.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, summary, [role=button], [tabindex]:not([tabindex="-1"])')) {
    if (e.offsetParent === null && getComputedStyle(e).position !== 'fixed') continue;
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

/** Checks every tab of the page; leaves the first tab shown. Returns problems prefixed with the tab. */
export async function checkA11y(evaluate) {
  if (!existsSync(AXE)) return [`axe-core missing: npm i --prefix tools --no-save --no-package-lock axe-core@4.10.2`];
  await evaluate(readFileSync(AXE, 'utf8'));
  const tabs = await evaluate(`[...document.querySelectorAll('#jill-deid-app .tabs button.tab')].map((b) => b.dataset.tab)`);
  const problems = [];
  for (const t of tabs) {
    await evaluate(`document.querySelector('#jill-deid-app .tabs [data-tab="${t}"]').click()`);
    await new Promise((r) => setTimeout(r, 500));
    problems.push(...(await evaluate(CHECK)).map((p) => `${t}: ${p}`));
  }
  await evaluate(`document.querySelector('#jill-deid-app .tabs [data-tab="${tabs[0]}"]').click()`);
  return [...new Set(problems)];
}
