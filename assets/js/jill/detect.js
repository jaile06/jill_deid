// Detection for one document (spec §3.3, §6.5). Every enabled rule runs in one module worker, one at a time; a rule
// that runs WATCHDOG_MS without finishing is skipped: the worker is terminated and restarted with the rules not yet
// done, and the rule is reported so the page can warn and ask before downloading (fail closed). Column candidates
// are added on the main thread; on equal spans the rule's category wins (rule candidates come first).
//
// The worker lives as long as the page: a new one would fetch its modules again, which fails offline under the
// no-cache policy (spec §4, §9.1). If it cannot be (re)started, the remaining rules count as skipped.
import { resolveOverlaps, toItems } from '../upstream/core/detector.js';
import { getPersonalHosts } from '../upstream/core/patterns.js';
import { columnCandidates } from './columns.js';
import { brokenTextCandidates } from './uri-scan.js';
import { config } from './config.js';

export const WATCHDOG_MS = 2000;
const LOAD_MS = 30000; // the first run loads the rule modules and libphonenumber
const WORKER_URL = new URL('./regex.worker.js', import.meta.url);

let worker = null;
let queue = Promise.resolve();

function scanOnce(text, rules, watchdogMs) {
  return new Promise((resolve) => {
    const cands = [];
    const skipped = [];
    const done = new Set();
    const finish = () => resolve({ cands, skipped });
    const start = () => {
      const todo = rules.filter((r) => !done.has(r.id) && !skipped.includes(r.id));
      if (todo.length === 0) return finish();
      let timer = 0;
      let running = null;
      const fail = () => { // cannot load or crashed: fail closed
        clearTimeout(timer);
        worker?.terminate();
        worker = null;
        skipped.push(...todo.filter((r) => !done.has(r.id) && !skipped.includes(r.id)).map((r) => r.id));
        finish();
      };
      const arm = (ms, onTimeout) => {
        clearTimeout(timer);
        timer = setTimeout(onTimeout, ms);
      };
      try {
        worker ??= new Worker(WORKER_URL, { type: 'module' });
      } catch {
        return fail();
      }
      arm(LOAD_MS, fail);
      worker.onerror = fail;
      worker.onmessage = ({ data }) => {
        if (data.start !== undefined) {
          running = data.start;
          arm(watchdogMs, () => {
            worker.terminate();
            worker = null;
            skipped.push(running);
            start();
          });
          return;
        }
        done.add(data.done);
        cands.push(...data.cands);
        if (done.size + skipped.length === rules.length) {
          clearTimeout(timer);
          finish();
        }
      };
      worker.postMessage({ type: 'detect', text, rules: todo, hosts: getPersonalHosts() });
    };
    start();
  });
}

/** Runs `rules` over `text` in the worker, one call at a time: { cands, skipped: rule ids }. */
export function scanInWorker(text, rules, watchdogMs = WATCHDOG_MS) {
  const run = queue.then(() => scanOnce(text, rules, watchdogMs));
  queue = run.catch(() => {});
  return run;
}

/** Items for `doc` with codes from `book`, and the names of rules skipped by the watchdog. */
export async function detectDocument(doc, patterns, book) {
  const enabled = patterns.filter((p) => p.enabled);
  const rules = enabled.map((p) => (p.source === 'builtin'
    ? { id: p.id, retention: p.retention }
    : { id: p.id, category: p.category, regex: p.regex, retention: p.retention, applyToUrl: p.applyToUrl }));
  const { cands, skipped } = await scanInWorker(doc.text, rules);
  const columns = columnCandidates(doc, config.columnLabels, (category) => enabled.find((p) => p.category === category)?.retention);
  return {
    items: toItems(doc.text, resolveOverlaps([...cands, ...columns, ...brokenTextCandidates(doc.text)]), book),
    skipped: skipped.map((id) => enabled.find((p) => p.id === id)?.name ?? id),
  };
}
