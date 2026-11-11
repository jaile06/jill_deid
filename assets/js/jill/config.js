// Settings from PHP (spec §7), read once from the page. A missing or broken block leaves the page usable
// without organisation rules and presets (spec §7), with a console warning.
const EMPTY = { version: 1, orgRules: [], presets: [], columnLabels: {} };

function read() {
  const node = typeof document === 'undefined' ? null : document.getElementById('jill-deid-config');
  if (!node) return EMPTY;
  try {
    return { ...EMPTY, ...JSON.parse(node.textContent) };
  } catch (e) {
    console.warn('jill_deid: unreadable settings, running without organisation rules and presets', e);
    return EMPTY;
  }
}

export const config = read();
