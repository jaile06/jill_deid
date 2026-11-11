// Acceptance run in the real themed page (spec §8 Phase 1b, §9.1) through headless Chrome over CDP.
// Usage: node tools/e2e.mjs [theme ...]          (default: school2022 xbootstrap5; Node >= 22 for WebSocket)
//   JILL_DEID_SITE  site root, default http://localhost
// Per theme: switch theme; choose the upstream samples (5 formats + scanned PDF via OCR) in the module page;
// download the batch ZIP; go offline, process a second PDF and restore a Word file with its mapping; then write <tmp>/jill_deid_e2e/<theme>.har
// and run tools/check-har.php with the originals of assets/samples/contract.mapping.csv.
// Dev tool; excluded from release by .gitattributes.
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { checkA11y } from './a11y.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const site = process.env.JILL_DEID_SITE ?? 'http://localhost';
const themes = process.argv.slice(2).length ? process.argv.slice(2) : ['school2022', 'xbootstrap5'];
const out = join(tmpdir(), 'jill_deid_e2e');
const samples = (names) => names.map((n) => join(root, 'assets', 'samples', n));
// roster.xlsx: fictitious roster with numeric 座號/學號 and surnames off the list; 12 items only with column labels (spec §6.5)
const ROSTER = join(root, 'tests', 'browser', 'fixtures', 'roster.xlsx');
// links.md: fictitious Markdown links; its output in the archive must hold none of LINK_LEAKS (spec §5.5)
// links.docx / links.xlsx: made in Word / Excel by tools/make-links-{docx,xlsx}.ps1 (hyperlinks, ScreenTips, HYPERLINK
// formula, header link, footnote, comments, author)
const LINKS = ['links.md', 'links.docx', 'links.xlsx'].map((n) => join(root, 'tests', 'browser', 'fixtures', n));
const LINK_LEAKS = ['A123456789', '%E5%B0%8F%E6%98%8E', '小明', 'wang.xm', 'chen.ml', '林志明', '測試作者'];
const TAR = 'C:/Windows/System32/tar.exe'; // Git Bash's tar reads C: as a remote host
const walkFiles = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walkFiles(join(d, e.name)) : [join(d, e.name)]));
const FIRST = [...samples(['contract.docx', 'quotation.pdf', 'scanned.pdf', 'customers.xlsx', 'meeting-notes.md', 'support-email.txt']), ROSTER, ...LINKS];
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
    // layout: each file's preview fills its panel, a PDF page as wide as the preview (a theme or module rule that
    // shrinks .preview, as `[tabindex="0"] { display: inline-flex }` once did, leaves a thumbnail-sized page)
    const layout = [];
    for (let i = 0; i < files.length; i++) {
      await evaluate(`document.querySelectorAll('#jill-deid-app .file-item-main')[${i}].click()`);
      await sleep(800);
      const m = await evaluate(`(() => { const p = document.querySelector('#jill-deid-app .preview'); const pg = p.querySelector('.pdf-page');
        return { name: document.querySelectorAll('#jill-deid-app .file-item-main')[${i}].textContent.split(/\\s/)[0], preview: p.getBoundingClientRect().width,
          panel: p.parentElement.getBoundingClientRect().width, page: pg ? pg.getBoundingClientRect().width : null }; })()`);
      if (m.preview < m.panel * 0.8 || (m.page !== null && m.page < m.preview * 0.8)) layout.push(`${m.name}: preview ${Math.round(m.preview)} of ${Math.round(m.panel)} px${m.page === null ? '' : `, page ${Math.round(m.page)} px`}`);
    }
    const a11y = await checkA11y(evaluate, send); // spec §9.4, every tab with the workspace filled

    await evaluate(`[...document.querySelectorAll('#jill-deid-app button')].find((b) => b.textContent.startsWith('打包下載全部')).click()`);
    for (let i = 0; i < 40 && !readdirSync(join(dir, 'downloads')).some((f) => f.endsWith('.zip')); i++) await sleep(500);
    const zip = readdirSync(join(dir, 'downloads')).find((f) => f.endsWith('.zip'));
    // Fixture outputs: rewritten or stripped links depend on the site's default preset (hyperlink_mode); either way
    // none of LINK_LEAKS may remain in any form, and Word / Excel must open the DOCX / XLSX without repair (spec §9.2 H15).
    const out = join(dir, 'out');
    rmSync(out, { recursive: true, force: true });
    for (const x of ['docx', 'xlsx']) mkdirSync(join(out, x), { recursive: true });
    let linksOut = '';
    let wordReport = 'not run';
    let wordOk = false;
    try {
      execFileSync(TAR, ['-xf', join(dir, 'downloads', zip), '-C', out, 'links.deid.md', 'links.deid.docx', 'links.deid.xlsx']);
      for (const x of ['docx', 'xlsx']) execFileSync(TAR, ['-xf', join(out, `links.deid.${x}`), '-C', join(out, x)]);
      linksOut = [join(out, 'links.deid.md'), ...walkFiles(join(out, 'docx')), ...walkFiles(join(out, 'xlsx'))].map((f) => readFileSync(f, 'utf8')).join('\n');
      try {
        wordReport = execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', join(root, 'tools', 'office-open.ps1'), join(out, 'links.deid.docx'), join(out, 'links.deid.xlsx')], { encoding: 'utf8' }).trim();
        wordOk = true;
      } catch (e) {
        wordReport = String(e.stdout ?? e.message).trim();
      }
    } catch {
      linksOut = '';
    }
    const forms = (v) => [v, encodeURIComponent(v), encodeURIComponent(v).replace(/%[0-9A-F]{2}/g, (m) => m.toLowerCase())];
    const linkLeaks = LINK_LEAKS.filter((v) => forms(v).some((f) => linksOut.includes(f)));
    const linksOk = linksOut.includes('學籍') && linksOut.includes('點此查看') && linkLeaks.length === 0 && wordOk;

    // upstream takes at most 10 files at a time: make room for the offline PDF (all were downloaded, so no prompt)
    const room = Math.max(0, FIRST.length + OFFLINE.length - 10);
    for (let i = 0; i < room; i++) await evaluate(`document.querySelector('#jill-deid-app .file-item-remove').click()`);
    await waitFor(`${fileCount} === ${FIRST.length - room}`, 10000, 'removing a file');
    const expected = FIRST.length - room + OFFLINE.length;

    offline = true;
    await send('Network.emulateNetworkConditions', OFFLINE_ON);
    const errorsBefore = await evaluate(`document.querySelectorAll('#jill-deid-portal .toast-error').length`);
    await chooseFiles(OFFLINE);
    await waitFor(`(${fileCount} === ${expected} || document.querySelectorAll('#jill-deid-portal .toast-error').length > ${errorsBefore}) && ${idle}`, 60000, 'the offline PDF');
    const offlineOk = await evaluate(`${fileCount} === ${expected}`);
    const offlineError = await evaluate(`[...document.querySelectorAll('#jill-deid-portal .toast-error')].map((t) => t.textContent).join(' | ')`);

    // still offline (spec §9.1): restore contract.deid.docx from this run's archive with its mapping table
    let restoreOk = false;
    let restoreNote = '';
    try {
      execFileSync(TAR, ['-xf', join(dir, 'downloads', zip), '-C', out, 'contract.deid.docx', 'contract.mapping.csv']);
      await evaluate(`document.querySelector('#jill-deid-app .tabs [data-tab="restore"]').click()`);
      await waitFor(`document.querySelectorAll('#jill-deid-app .restore-view input[type=file]').length === 2`, 10000, 'the restore page');
      // a filled slot turns into a chip, so pick each input by what it accepts
      for (const [sel, f] of [['input[type=file]:not([accept^=".csv"])', 'contract.deid.docx'], ['input[type=file][accept^=".csv"]', 'contract.mapping.csv']]) {
        const { result } = await send('Runtime.evaluate', { expression: `document.querySelector('#jill-deid-app .restore-view ${sel}')` });
        const r = await send('DOM.setFileInputFiles', { files: [join(out, f)], objectId: result.objectId });
        if (r.error) throw new Error(`restore ${f}: ${r.error.message}`);
        await sleep(1500);
      }
      await waitFor(`!!document.querySelector('#jill-deid-app .restore-result')`, 30000, 'the offline restore');
      const shown = await evaluate(`document.querySelector('#jill-deid-app .restore-result').textContent`);
      const original = mappingValues(join(out, 'contract.mapping.csv'));
      const back = original.filter((v) => shown.includes(v)).length;
      restoreOk = !shown.includes('無法還原') && back > 0;
      restoreNote = `${back} / ${original.length} originals shown`;
    } catch (e) {
      restoreNote = e.message;
    }

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
    const ok = layout.length === 0 && restoreOk && a11y.length === 0 && rosterOk && linksOk && shownTheme === theme && !translate && files.length === FIRST.length && !!zip && offlineOk && harOk && problems.length === 0;
    console.log([
      `== ${theme}: ${ok ? 'PASS' : 'FAIL'}`,
      `theme in page: ${shownTheme}; translate widget: ${translate ? 'PRESENT' : 'none'}`,
      ...files.map((f) => `  ${f}`),
      `roster column detection: ${rosterOk ? 'ok' : 'FAILED'}`,
      `preview layout: ${layout.length ? 'FAILED' : 'ok'}`,
      ...layout.map((l) => `  layout: ${l}`),
      `accessibility (spec §9.4): ${a11y.length ? 'FAILED' : 'ok'}`,
      ...a11y.map((p) => `  a11y: ${p}`),
      `link fixtures (md, docx, xlsx): ${linksOk ? 'ok' : `FAILED ${linkLeaks.join(', ') || 'output missing or Office failed'}`}`,
      ...wordReport.split(/\r?\n/).map((l) => `  office: ${l.trim()}`),
      `zip: ${zip ? `${zip} (${statSync(join(dir, 'downloads', zip)).size} bytes)` : 'MISSING'}`,
      `offline second PDF: ${offlineOk ? 'ok' : `FAILED ${offlineError}`}`,
      `offline restore (contract.docx): ${restoreOk ? 'ok' : 'FAILED'} ${restoreNote}`,
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
