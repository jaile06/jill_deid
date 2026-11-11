// The part of vitest the ported upstream tests use (spec §9.2), on top of ../runner.js: describe/it/test with .each,
// beforeAll/beforeEach/afterEach scoped like vitest, the matchers the tests call, and a little of vi. Node's
// readFileSync becomes a synchronous request to this site (fixtures copied next to the tests).
import { it as queue } from '../runner.js';

// ---------------------------------------------------------------------------------------------- scopes and tests
const newScope = (name, parent) => ({ name, parent, beforeAll: [], beforeEach: [], afterEach: [], ran: false });
let scope = newScope('', null);

/** Called first by every ported file (tools/port-upstream-tests.mjs): hooks of one file never reach the next. */
export function fileScope(name) {
  scope = newScope(`upstream/${name} › `, null);
  scope.beforeAll.push(resetDom);
}

/** vitest gives every file a fresh DOM: leave only the report and an empty portal, and clear browser storage. */
function resetDom() {
  for (const n of [...document.body.children]) if (!['summary', 'results', 'jill-deid-portal'].includes(n.id)) n.remove();
  // components.js keeps its toast host in a module variable: empty it, never detach it
  for (const n of [...(PORTAL?.children ?? [])]) {
    if (n.classList.contains('toast-host')) n.replaceChildren();
    else n.remove();
  }
  localStorage.clear();
}

const chain = (s) => (s ? [...chain(s.parent), s] : []);
const label = (s) => chain(s).map((x) => x.name).join('');

export function describe(name, fn) {
  const prev = scope;
  scope = newScope(`${name} › `, prev);
  fn();
  scope = prev;
}

// Upstream tests may empty document.body; the portal (where toasts live, in a host components.js keeps) goes back
// before every test, as vitest's fresh DOM per file would have it.
const PORTAL = document.getElementById('jill-deid-portal');

export function it(name, fn) {
  const own = scope;
  queue(label(own) + name, async () => {
    if (PORTAL && !PORTAL.isConnected) document.body.append(PORTAL);
    const scopes = chain(own);
    for (const s of scopes) {
      if (!s.ran) {
        s.ran = true;
        for (const h of s.beforeAll) await h();
      }
    }
    for (const s of scopes) for (const h of s.beforeEach) await h();
    try {
      await fn();
    } finally {
      for (const s of scopes.reverse()) for (const h of s.afterEach) await h();
    }
  });
}
export const test = it;
it.skip = () => {};
export const beforeAll = (fn) => scope.beforeAll.push(fn);
export const beforeEach = (fn) => scope.beforeEach.push(fn);
export const afterEach = (fn) => scope.afterEach.push(fn);

/** vitest's name formatting for .each: %s %d %i %j %o in order, or $key for object rows. */
function format(name, row) {
  const args = Array.isArray(row) ? [...row] : [row];
  let out = name.replace(/%[sdijo]/g, (m) => {
    const v = args.shift();
    return m === '%j' || m === '%o' ? JSON.stringify(v) : String(v);
  });
  if (row && typeof row === 'object' && !Array.isArray(row)) out = out.replace(/\$(\w+)/g, (_, k) => String(row[k]));
  return out;
}
const each = (register) => (table) => (name, fn) => {
  for (const row of table) register(format(name, row), () => (Array.isArray(row) ? fn(...row) : fn(row)));
};
it.each = each(it);
describe.each = each(describe);

// ---------------------------------------------------------------------------------------------- expect
const show = (v) => {
  try {
    return typeof v === 'string' ? JSON.stringify(v) : JSON.stringify(v, (_, x) => (x instanceof Map ? [...x] : x instanceof Set ? [...x] : x)) ?? String(v);
  } catch {
    return String(v);
  }
};

const ASYMMETRIC = Symbol('asymmetric');
function equal(a, b) {
  if (b && b[ASYMMETRIC]) return b.test(a);
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (a instanceof Map || b instanceof Map) return a instanceof Map && b instanceof Map && a.size === b.size && [...a].every(([k, v]) => b.has(k) && equal(v, b.get(k)));
  if (a instanceof Set || b instanceof Set) return a instanceof Set && b instanceof Set && a.size === b.size && [...a].every((v) => [...b].some((w) => equal(v, w)));
  if (ArrayBuffer.isView(a) || ArrayBuffer.isView(b)) return ArrayBuffer.isView(a) && ArrayBuffer.isView(b) && a.length === b.length && a.every((x, i) => x === b[i]);
  if (a instanceof Date || b instanceof Date) return a instanceof Date && b instanceof Date && +a === +b;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && a.length !== b.length) return false;
  // toEqual ignores properties that are undefined
  const ka = Object.keys(a).filter((k) => a[k] !== undefined);
  const kb = Object.keys(b).filter((k) => b[k] !== undefined);
  return ka.length === kb.length && ka.every((k) => Object.hasOwn(b, k) && equal(a[k], b[k]));
}
/** toMatchObject: every property of `b` is in `a` (recursively for objects; arrays element by element). */
function subset(a, b) {
  if (b && b[ASYMMETRIC]) return b.test(a);
  if (typeof b !== 'object' || b === null) return Object.is(a, b);
  if (typeof a !== 'object' || a === null) return false;
  if (Array.isArray(b)) return Array.isArray(a) && a.length === b.length && b.every((x, i) => subset(a[i], x));
  return Object.keys(b).every((k) => subset(a[k], b[k]));
}
const contains = (actual, e) => (typeof actual === 'string' ? actual.includes(e) : [...actual].some((x) => Object.is(x, e)));
const errorMatches = (err, e) => e === undefined
  || (typeof e === 'string' ? String(err?.message).includes(e) : e instanceof RegExp ? e.test(String(err?.message)) : err instanceof e);

function matchers(actual, negate) {
  const check = (ok, what) => {
    if (Boolean(ok) === negate) throw new Error(`expected ${show(actual)} ${negate ? 'not ' : ''}${what}`);
  };
  return {
    toBe: (e) => check(Object.is(actual, e), `to be ${show(e)}`),
    toEqual: (e) => check(equal(actual, e), `to equal ${show(e)}`),
    toStrictEqual: (e) => check(equal(actual, e), `to equal ${show(e)}`),
    toContain: (e) => check(actual != null && contains(actual, e), `to contain ${show(e)}`),
    toHaveLength: (n) => check(actual?.length === n, `to have length ${n} (has ${actual?.length})`),
    toBeGreaterThan: (n) => check(actual > n, `> ${n}`),
    toBeGreaterThanOrEqual: (n) => check(actual >= n, `>= ${n}`),
    toBeLessThan: (n) => check(actual < n, `< ${n}`),
    toBeLessThanOrEqual: (n) => check(actual <= n, `<= ${n}`),
    toBeCloseTo: (n, digits = 2) => check(Math.abs(actual - n) < 10 ** -digits / 2, `to be close to ${n}`),
    toMatch: (e) => check(typeof e === 'string' ? String(actual).includes(e) : e.test(String(actual)), `to match ${e}`),
    toMatchObject: (e) => check(subset(actual, e), `to match object ${show(e)}`),
    toBeNull: () => check(actual === null, 'to be null'),
    toBeDefined: () => check(actual !== undefined, 'to be defined'),
    toBeUndefined: () => check(actual === undefined, 'to be undefined'),
    toBeTruthy: () => check(actual, 'to be truthy'),
    toBeFalsy: () => check(!actual, 'to be falsy'),
    toThrow: (e) => {
      let err;
      let threw = false;
      try {
        actual();
      } catch (x) {
        threw = true;
        err = x;
      }
      check(threw && errorMatches(err, e), `to throw ${e ?? ''}${threw ? ` (threw ${err?.message})` : ''}`);
    },
    toHaveBeenCalledWith: (...args) => check(actual.mock.calls.some((c) => equal(c, args)), `to have been called with ${show(args)}`),
  };
}

export function expect(actual) {
  const m = matchers(actual, false);
  m.not = matchers(actual, true);
  m.rejects = {
    toThrow: async (e) => {
      try {
        await actual;
      } catch (err) {
        if (!errorMatches(err, e)) throw new Error(`expected rejection matching ${e}, got ${err?.message}`);
        return;
      }
      throw new Error(`expected a rejection matching ${e}`);
    },
  };
  return m;
}
expect.arrayContaining = (items) => ({ [ASYMMETRIC]: true, test: (a) => Array.isArray(a) && items.every((x) => a.some((y) => equal(y, x))) });

// ---------------------------------------------------------------------------------------------- vi
export const vi = {
  /** Bumped by resetModules; the port tool turns `import('…src…')` into a fresh import per epoch. */
  epoch: 0,
  resetModules() {
    vi.epoch++;
  },
  /** fetch is never stubbed: the site serves the fonts the upstream tests stub it for. */
  stubGlobal(name, value) {
    if (name !== 'fetch') globalThis[name] = value;
  },
  fn() {
    const calls = [];
    let impl = () => undefined;
    const f = (...args) => {
      calls.push(args);
      return impl(...args);
    };
    f.mock = { calls };
    f.mockResolvedValue = (v) => {
      impl = () => Promise.resolve(v);
      return f;
    };
    f.mockReturnValue = (v) => {
      impl = () => v;
      return f;
    };
    return f;
  },
  async waitFor(fn, { timeout = 1000, interval = 50 } = {}) {
    for (const t0 = performance.now(); ; await new Promise((r) => setTimeout(r, interval))) {
      try {
        return await fn();
      } catch (e) {
        if (performance.now() - t0 > timeout) throw e;
      }
    }
  },
};

// ---------------------------------------------------------------------------------------------- node:fs
const MODULE = new URL('../../../', import.meta.url); // modules/jill_deid/
/** Upstream repository paths → where this module serves the same file. */
const PATHS = [
  [/^tests\/fixtures\//, 'tests/browser/upstream/fixtures/'],
  [/^public\/fonts\//, 'assets/fonts/'],
  [/^public\/samples\//, 'assets/samples/'],
  [/^scripts\/assets\/scan\//, 'tests/browser/upstream/fixtures/'],
];
export function readFileSync(path, encoding) {
  const rel = PATHS.reduce((p, [re, to]) => p.replace(re, to), String(path));
  const xhr = new XMLHttpRequest();
  xhr.open('GET', new URL(rel, MODULE).href, false); // synchronous, as readFileSync is
  if (!encoding) xhr.overrideMimeType('text/plain; charset=x-user-defined');
  xhr.send();
  if (xhr.status !== 200) throw new Error(`readFileSync: ${rel} (${xhr.status})`);
  if (encoding) return xhr.responseText;
  const s = xhr.responseText;
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i) & 0xff;
  return bytes;
}
// ---------------------------------------------------------------------------------------------- Buffer
/**
 * The tests only read bytes as latin1 text (Buffer.from(bytes).toString('latin1')); the port tool points them here.
 * Not a global: JSZip takes a global Buffer for Node and breaks.
 */
export const LatinBuffer = {
  from: (bytes) => ({ toString: () => Array.from(bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes, (b) => String.fromCharCode(b)).join('') }),
};
