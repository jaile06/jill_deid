// Minimal describe/it/expect for the browser test page (spec §9.2): only the matchers the tests use.
const queue = [];
let prefix = '';

export function describe(name, fn) {
  const prev = prefix;
  prefix = `${prev}${name} › `;
  fn();
  prefix = prev;
}

export function it(name, fn) {
  queue.push({ name: prefix + name, fn });
}

const show = (v) => JSON.stringify(v);
const check = (ok, msg) => {
  if (!ok) throw new Error(msg);
};

export function expect(actual) {
  return {
    toBe: (e) => check(Object.is(actual, e), `expected ${show(e)}, got ${show(actual)}`),
    toEqual: (e) => check(show(actual) === show(e), `expected ${show(e)}, got ${show(actual)}`),
    toContain: (e) => check(actual.includes(e), `expected ${show(actual)} to contain ${show(e)}`),
    toBeLessThan: (e) => check(actual < e, `expected ${actual} < ${e}`),
    not: { toContain: (e) => check(!actual.includes(e), `expected ${show(actual)} not to contain ${show(e)}`) },
  };
}

/** Runs every queued test; the page title becomes PASS or FAIL n so headless runs can read it. */
export async function run() {
  // held from the start: a test that empties document.body (upstream UI tests do) must not lose the report
  const list = document.getElementById('results');
  const summary = document.getElementById('summary');
  let failed = 0;
  for (const t of queue) {
    const li = document.createElement('li');
    try {
      await t.fn();
      li.textContent = `ok   ${t.name}`;
    } catch (e) {
      failed++;
      li.textContent = `FAIL ${t.name}: ${e.message}`;
      li.className = 'fail';
    }
    list.append(li);
  }
  if (!summary.isConnected || !list.isConnected) document.body.prepend(summary, list);
  summary.textContent = `${queue.length - failed}/${queue.length} passed`;
  document.title = failed ? `FAIL ${failed}` : 'PASS';
}
