// Entry: mounts the upstream views (assets/js/upstream/ui/) inside the themed page (spec §6.1). Replaces
// upstream main.ts without its header, author links and FAQ; the tab buttons come from the template.
import { installTooltips } from '../upstream/ui/components.js';
import { createProcessView, hasUnsavedResults, setPresets, syncPatternChanges } from '../upstream/ui/process-view.js';
import { createPatternsView } from '../upstream/ui/patterns-view.js';
import { createRestoreView } from '../upstream/ui/restore-view.js';
import { CATEGORIES } from '../upstream/core/types.js';
import { setOrgPatterns } from '../upstream/core/pattern-store.js';
import { setPersonalHosts } from '../upstream/core/patterns.js';
import { config } from './config.js';

const CREATE = { process: createProcessView, patterns: createPatternsView, restore: createRestoreView };

// Module settings (spec §7) before any view exists: organisation rules join detection, presets set the output,
// and their categories and the column-label categories join the closed upstream list (spec §4 core/types.js).
for (const c of [...config.orgRules.map((r) => r.category), ...Object.values(config.columnLabels)]) {
  if (!CATEGORIES.includes(c)) CATEGORIES.push(c);
}
setOrgPatterns(config.orgRules);
setPersonalHosts(config.urlPersonalHosts);
setPresets(config.presets);

// What upstream puts on <body> (tooltip, toasts, dialogs, OCR screen, add popup) goes here, inside the CSS scope.
const portal = document.createElement('div');
portal.id = 'jill-deid-portal';
portal.translate = false; // translate="no": browser and widget translators skip document content
portal.className = 'notranslate';
document.body.append(portal);

const app = document.getElementById('jill-deid-app');
const nav = app.querySelector('.tabs');
const panels = app.querySelector('.panels');
const views = new Map();

const activate = (id) => {
  document.querySelector('.add-popup')?.remove();
  window.getSelection()?.removeAllRanges();
  for (const t of Object.keys(CREATE)) {
    nav.querySelector(`[data-tab="${t}"]`)?.classList.toggle('active', t === id);
    let v = views.get(t);
    if (!v && t === id) {
      v = CREATE[t]();
      views.set(t, v);
      panels.append(v);
    }
    if (v) v.hidden = t !== id;
  }
  // Pattern changes made in another tab should be visible on return (as upstream main.ts).
  if (id === 'patterns') {
    const fresh = createPatternsView();
    views.get('patterns')?.replaceWith(fresh);
    views.set('patterns', fresh);
  }
  if (id === 'process') syncPatternChanges();
};

nav.addEventListener('click', (e) => {
  const id = e.target.closest('button[data-tab]')?.dataset.tab;
  if (id) activate(id);
});
activate('process');
installTooltips();

window.addEventListener('beforeunload', (e) => {
  if (hasUnsavedResults()) {
    e.preventDefault();
    e.returnValue = '';
  }
});
