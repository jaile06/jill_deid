// Acceptance run in the real themed page (spec §8 Phase 1b, §9.1) through headless Chrome over CDP.
// Usage: node tools/e2e.mjs [theme ...]          (default: school2022 xbootstrap5; Node >= 22 for WebSocket)
//   JILL_DEID_SITE  site root, default http://localhost
// Per theme: switch theme; choose the upstream samples (5 formats + scanned PDF via OCR) in the module page;
// download the batch ZIP; go offline and process a second PDF; then write <tmp>/jill_deid_e2e/<theme>.har
// and run tools/check-har.php with the originals of assets/samples/contract.mapping.csv.
// Dev tool; excluded from release by .gitattributes.
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const site = process.env.JILL_DEID_SITE ?? 'http://localhost';
const themes = process.argv.slice(2).length ? process.argv.slice(2) : ['school2022', 'xbootstrap5'];
const out = join(tmpdir(), 'jill_deid_e2e');
const samples = (names) => names.map((n) => join(root, 'assets', 'samples', n));
// roster.xlsx: fictitious roster with numeric 座號/學號 and surnames off the list; 12 items only with column labels (spec §6.5)
const ROSTER = join(root, 'tests', 'browser', 'fixtures', 'roster.xlsx');
const FIRST = [...samples(['contract.docx', 'quotation.pdf', 'scanned.pdf', 'customers.xlsx', 'meeting-notes.md', 'support-email.txt']), ROSTER];
const OFFLINE = samples(['contract.pdf']);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Originals from the sample mapping table (RFC 4180, header code,category,original[,kept_prefix,kept_suffix]). */
function mappingValues(file) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const text = readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') quoted = false; else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell || row.length) rows.push([...row, cell]);
  const col = rows[0].indexOf('original');
  return [...new Set(rows.slice(1).map((r) => r[col]).filter((v) => v && v.length >= 2))];
}

async function runTheme(theme) {
  const dir = join(out, theme);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, 'downloads'), { recursive: true });
  const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
    '--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=9334', '--window-size=1400,1000',
    `--user-data-dir=${join(dir, 'profile')}`, 'about:blank',
  ], { stdio: 'ignore' });
  try {
    let targets;
    for (let i = 0; i < 50 && !targets; i++) {
      await sleep(200);
      targets = await fetch('http://127.0.0.1:9334/json').then((r) => r.json()).catch(() => null);
    }
    const ws = new WebSocket(targets.find((t) => t.type === 'page').webSocketDebuggerUrl);
    await new Promise((r) => ws.addEventListener('open', r));
    let seq = 0;
    let offline = false;
    const pending = new Map();
    const requests = [];
    const problems = [];
    const send = (method, params = {}, sessionId) => new Promise((r) => {
      pending.set(++seq, r);
      ws.send(JSON.stringify({ id: seq, method, params, ...(sessionId && { sessionId }) }));
    });
    const OFFLINE_ON = { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 };
    ws.addEventListener('message', async (e) => {
      const m = JSON.parse(e.data);
      if (m.id && pending.has(m.id)) {
        pending.get(m.id)(m.error ? { error: m.error } : m.result);
        pending.delete(m.id);
        return;
      }
      const p = m.params ?? {};
      if (m.method === 'Network.requestWillBeSent') {
        const r = p.request;
        requests.push({
          startedDateTime: new Date(p.wallTime * 1000).toISOString(),
          request: { method: r.method, url: r.url, headers: Object.entries(r.headers).map(([name, value]) => ({ name, value })), ...(r.postData && { postData: { text: r.postData } }), bodySize: r.hasPostData ? 1 : 0 },
        });
      }
      if (m.method === 'Target.attachedToTarget') { // workers: OCR, pdf.js
        const s = p.sessionId;
        await send('Network.enable', {}, s);
        if (offline) await send('Network.emulateNetworkConditions', OFFLINE_ON, s);
        await send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: false, flatten: true }, s);
        await send('Runtime.runIfWaitingForDebugger', {}, s);
      }
      if (m.method === 'Runtime.exceptionThrown') problems.push(`exception: ${p.exceptionDetails.exception?.description ?? p.exceptionDetails.text}`);
      if (m.method === 'Runtime.consoleAPICalled' && p.type === 'error') problems.push(`console.error: ${p.args.map((a) => a.value ?? a.description).join(' ')}`);
    });
    const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.value;
    const waitFor = async (expression, ms, what) => {
      for (const t0 = Date.now(); !(await evaluate(expression)); await sleep(500)) {
        if (Date.now() - t0 > ms) {
          const state = await evaluate(`JSON.stringify({ files: document.querySelectorAll('#jill-deid-app .file-item').length,
            overlay: [...document.querySelectorAll('#jill-deid-portal .ocr-overlay, #jill-deid-portal .busy-overlay')].filter((e) => getComputedStyle(e).display !== 'none').map((e) => e.textContent.slice(0, 200)),
            toasts: [...document.querySelectorAll('#jill-deid-portal .toast')].map((t) => t.textContent) })`);
          throw new Error(`${theme}: timed out waiting for ${what}: ${state}\n${problems.join('\n')}`);
        }
      }
    };
    const chooseFiles = async (files) => {
      const { result } = await send('Runtime.evaluate', { expression: `document.querySelector('#jill-deid-app input[type=file][accept^=".txt"]')` });
      const r = await send('DOM.setFileInputFiles', { files, objectId: result.objectId });
      if (r.error) throw new Error(`setFileInputFiles: ${r.error.message}`);
    };
    const fileCount = `document.querySelectorAll('#jill-deid-app .file-item').length`;
    const idle = `![...document.querySelectorAll('#jill-deid-portal .ocr-overlay, #jill-deid-portal .busy-overlay')].some((e) => getComputedStyle(e).display !== 'none')`;

    for (const d of ['Page', 'Runtime', 'Network', 'DOM']) await send(`${d}.enable`);
    await send('Target.setAutoAttach', { autoAttach: true, waitForDebuggerOnStart: false, flatten: true });
    await send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: join(dir, 'downloads') });

    await send('Page.navigate', { url: `${site}/index.php` });
    await sleep(2500);
    await evaluate(`(() => { const f = document.createElement('form'); f.method = 'post'; f.action = '${site}/index.php';
      const i = document.createElement('input'); i.name = 'xoops_theme_select'; i.value = '${theme}'; f.append(i); document.body.append(f); f.submit(); })()`);
    await sleep(2500);
    requests.length = 0; // the HAR covers the module page only
    await send('Page.navigate', { url: `${site}/modules/jill_deid/index.php` });
    await waitFor(`!!document.querySelector('#jill-deid-app .sample-card')`, 20000, 'the interface');
    const shownTheme = await evaluate(`[...document.querySelectorAll('link[href*="/themes/"]')].map((l) => l.href.match(/themes\\/([^/]+)/)[1])[0]`);
    const translate = await evaluate(`!!document.querySelector('#google_translate_element, script[src*="translate.google"]')`);

    const since = new Date().toISOString();
    await chooseFiles(FIRST);
    await waitFor(`${fileCount} === ${FIRST.length} && ${idle}`, 300000, 'the first batch (OCR included)');
    const files = await evaluate(`[...document.querySelectorAll('#jill-deid-app .file-item')].map((li) => li.textContent.replace(/\\s+/g, ' ').trim())`);

    await evaluate(`[...document.querySelectorAll('#jill-deid-app button')].find((b) => b.textContent.startsWith('打包下載全部')).click()`);
    for (let i = 0; i < 40 && !readdirSync(join(dir, 'downloads')).some((f) => f.endsWith('.zip')); i++) await sleep(500);
    const zip = readdirSync(join(dir, 'downloads')).find((f) => f.endsWith('.zip'));

    offline = true;
    await send('Network.emulateNetworkConditions', OFFLINE_ON);
    const errorsBefore = await evaluate(`document.querySelectorAll('#jill-deid-portal .toast-error').length`);
    await chooseFiles(OFFLINE);
    await waitFor(`(${fileCount} === ${FIRST.length + 1} || document.querySelectorAll('#jill-deid-portal .toast-error').length > ${errorsBefore}) && ${idle}`, 60000, 'the offline PDF');
    const offlineOk = await evaluate(`${fileCount} === ${FIRST.length + 1}`);
    const offlineError = await evaluate(`[...document.querySelectorAll('#jill-deid-portal .toast-error')].map((t) => t.textContent).join(' | ')`);

    const har = join(dir, `${theme}.har`);
    writeFileSync(har, JSON.stringify({ log: { version: '1.2', creator: { name: 'jill_deid e2e', version: '1' }, entries: requests } }));
    const values = join(dir, 'values.txt');
    writeFileSync(values, mappingValues(join(root, 'assets', 'samples', 'contract.mapping.csv')).join('\n'));
    let harReport;
    let harOk = true;
    try {
      harReport = execFileSync('E:/my_xoops274/core/php83/php.exe', [join(root, 'tools', 'check-har.php'), har, values, `--since=${since}`], { encoding: 'utf8' });
    } catch (e) {
      harReport = e.stdout;
      harOk = false;
    }

    ws.close();
    const rosterOk = files.some((f) => f.startsWith('roster.xlsx') && f.includes('12 / 12'));
    const ok = rosterOk && shownTheme === theme && !translate && files.length === FIRST.length && !!zip && offlineOk && harOk && problems.length === 0;
    console.log([
      `== ${theme}: ${ok ? 'PASS' : 'FAIL'}`,
      `theme in page: ${shownTheme}; translate widget: ${translate ? 'PRESENT' : 'none'}`,
      ...files.map((f) => `  ${f}`),
      `roster column detection: ${rosterOk ? 'ok' : 'FAILED'}`,
      `zip: ${zip ? `${zip} (${statSync(join(dir, 'downloads', zip)).size} bytes)` : 'MISSING'}`,
      `offline second PDF: ${offlineOk ? 'ok' : `FAILED ${offlineError}`}`,
      harReport.trim(),
      ...problems.map((p) => `  ${p}`),
    ].join('\n'));
    return ok;
  } finally {
    chrome.kill();
  }
}

let allOk = true;
for (const t of themes) allOk = (await runTheme(t)) && allOk;
process.exit(allOk ? 0 : 1);
