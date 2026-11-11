// Ported by tools/port-upstream-tests.mjs from upstream tests/unit/busy.test.ts; do not edit (spec §9.2).
import { fileScope } from '../vitest-shim.js';
fileScope('unit/busy.test');
import { describe, expect, it } from '../vitest-shim.js';
import { withBusy } from '../../../../assets/js/upstream/ui/components.js';

const tick = (ms        ) => new Promise((r) => setTimeout(r, ms));

describe('withBusy', () => {
  it('locks #app for the whole task and shows the overlay once the task turns out to be slow', async () => {
    document.body.innerHTML = '<div id="app"><button>x</button></div>';
    const app = document.getElementById('app') ;
    let finish             ;
    const run = withBusy('載入範例中…', () => new Promise      ((r) => (finish = r)));

    expect(app.hasAttribute('inert')).toBe(true);
    await tick(200);
    const overlay = document.querySelector             ('.busy-overlay') ;
    expect(overlay.hidden).toBe(false);
    expect(overlay.textContent).toContain('載入範例中…');

    finish();
    await run;
    expect(app.hasAttribute('inert')).toBe(false);
    expect(overlay.hidden).toBe(true);
  });

  it('does not flash the overlay for a task that finishes quickly, and unlocks even when it throws', async () => {
    const app = document.getElementById('app') ;
    await expect(withBusy('讀取檔案中…', () => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    expect(app.hasAttribute('inert')).toBe(false);
    await tick(200);
    expect(document.querySelector             ('.busy-overlay') .hidden).toBe(true);
  });
});
