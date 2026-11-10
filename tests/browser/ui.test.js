// The upstream interface inside the module (spec §6.1): scoped styles, heading levels, and one real flow.
import { describe, expect, it } from './runner.js';
import { createProcessView } from '../../assets/js/upstream/ui/process-view.js';
import { createPatternsView } from '../../assets/js/upstream/ui/patterns-view.js';
import { createRestoreView } from '../../assets/js/upstream/ui/restore-view.js';

const SCOPE = ':is(#jill-deid-app, #jill-deid-portal)';
const until = async (ok, ms = 30000) => {
  const t0 = performance.now();
  while (!ok()) {
    if (performance.now() - t0 > ms) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 50));
  }
};

describe('styles', () => {
  for (const file of ['upstream.css', 'jill_deid.css']) {
    it(`${file}: every style rule is limited to the app and its portal`, async () => {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(await (await fetch(`../../assets/css/${file}`)).text());
      const outside = [];
      const walk = (rules) => {
        for (const r of rules) {
          if (r instanceof CSSStyleRule) {
            for (const s of r.selectorText.split(/,(?![^(]*\))/)) if (!s.trim().startsWith(SCOPE)) outside.push(s.trim());
          } else if (r.cssRules) walk(r.cssRules); // @media, @supports; @keyframes have no style rules
        }
      };
      walk(sheet.cssRules);
      expect(sheet.cssRules.length > 0).toBe(true);
      expect(outside).toEqual([]);
    });
  }
});

describe('views', () => {
  const host = document.createElement('div');
  host.id = 'jill-deid-app';
  document.body.append(host);

  it('use no h1–h3 (the template owns <h3>, spec §9.4)', () => {
    const views = [createProcessView(), createPatternsView(), createRestoreView()];
    host.append(...views);
    expect(host.querySelectorAll('h1, h2, h3').length).toBe(0);
    expect(host.querySelectorAll('h4').length > 0).toBe(true);
    for (const v of views.slice(1)) v.remove();
  });

  it('loads the upstream Word sample and marks items in the preview', async () => {
    const card = host.querySelector('.sample-card');
    expect(card.textContent).toContain('委外服務契約書');
    card.querySelector('button.btn-primary').click();
    await until(() => host.querySelectorAll('.mark').length > 0);
    expect(host.querySelectorAll('.mark').length > 20).toBe(true);
  });
});
