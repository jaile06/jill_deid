// Runs the browser test pages in headless Chrome in real time (spec §9.2), each until its title becomes PASS or
// FAIL n. Real time matters: --virtual-time-budget fast-forwards timers, so a worker watchdog would fire before the
// worker answers. Usage: node tools/browser-tests.mjs [url ...]. Dev tool; excluded from release.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// presets.html and the *-ui.html pages are pages of their own: the process view keeps its documents in module state
const base = 'http://localhost/modules/jill_deid/tests/browser/';
const urls = process.argv.length > 2 ? process.argv.slice(2) : ['index.html', 'presets.html', 'process-ui.html', 'patterns-ui.html', 'restore-ui.html'].map((p) => base + p);
const profile = mkdtempSync(join(tmpdir(), 'jill_deid_tests-'));
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=9335', `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let code = 1;
try {
  let targets;
  for (let i = 0; i < 50 && !targets; i++) {
    await sleep(200);
    targets = await fetch('http://127.0.0.1:9335/json').then((r) => r.json()).catch(() => null);
  }
  const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (pending.has(m.id)) pending.get(m.id)(m.result);
  });
  const send = (method, params = {}) => new Promise((r) => {
    pending.set(++id, r);
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true })).result?.value;
  code = 0;
  for (const url of urls) {
    await send('Page.navigate', { url });
    await sleep(300); // let the old page go before reading the title
    let title = '';
    for (const t0 = Date.now(); !/^(PASS|FAIL)/.test(title) && Date.now() - t0 < 300000; await sleep(500)) title = (await evaluate('document.title')) ?? '';
    const summary = await evaluate(`document.getElementById('summary')?.textContent`);
    const failures = (await evaluate(`[...document.querySelectorAll('#results .fail')].map((li) => li.textContent)`)) ?? [];
    console.log(`browser tests ${url.split('/').pop()}: ${summary ?? 'no summary'} (${title || 'timed out'})`);
    for (const f of failures) console.log(`  ${f}`);
    if (title !== 'PASS') code = 1;
  }
  ws.close();
} finally {
  chrome.kill();
  await sleep(300);
  rmSync(profile, { recursive: true, force: true });
}
process.exit(code);
