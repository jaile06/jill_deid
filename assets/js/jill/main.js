// Phase 1b entry: mounts the upstream views inside the XOOPS page (replaces upstream main.js, which is not loaded).
// ponytail: tabs only. role="tablist", arrow keys and i18n come in Phase 3a (spec §4).
import { el, installTooltips } from '../upstream/ui/components.js';
import { createProcessView, hasUnsavedResults, syncPatternChanges } from '../upstream/ui/process-view.js';
import { createPatternsView } from '../upstream/ui/patterns-view.js';
import { createRestoreView } from '../upstream/ui/restore-view.js';

const TABS = [
  { id: 'process', label: '去識別化', create: createProcessView },
  { id: 'patterns', label: '偵測規則', create: createPatternsView },
  { id: 'restore', label: '還原', create: createRestoreView },
];

const app = document.getElementById('jill-deid-app');
const nav = el('nav', { class: 'tabs' });
const panels = el('div', { class: 'panels' });
const views = new Map();

const activate = (id) => {
  document.querySelector('.add-popup')?.remove();
  window.getSelection()?.removeAllRanges();
  for (const t of TABS) {
    nav.querySelector(`[data-tab="${t.id}"]`)?.classList.toggle('active', t.id === id);
    let v = views.get(t.id);
    if (!v && t.id === id) {
      v = t.create();
      views.set(t.id, v);
      panels.append(v);
    }
    if (v) v.hidden = t.id !== id;
  }
  if (id === 'patterns') {
    const fresh = createPatternsView();
    views.get('patterns')?.replaceWith(fresh);
    views.set('patterns', fresh);
  }
  if (id === 'process') syncPatternChanges();
};

for (const t of TABS) {
  nav.append(el('button', { class: 'tab', 'data-tab': t.id, type: 'button', onClick: () => activate(t.id) }, t.label));
}
app.append(nav, panels);
activate('process');
installTooltips();

window.addEventListener('beforeunload', (e) => {
  if (hasUnsavedResults()) {
    e.preventDefault();
    e.returnValue = '';
  }
});
