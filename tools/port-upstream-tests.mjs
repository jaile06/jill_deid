// Ports the upstream vitest suite to the browser test page (spec §9.2, Phase 4d): tests/unit, tests/integration and
// tests/helpers → tests/browser/upstream/, fixtures copied, page index.html written. Types are stripped the same way
// as tools/strip-upstream.mjs; imports point at the converted modules (assets/js/upstream/) and vendor files;
// vitest and node:fs become tests/browser/upstream/vitest-shim.js. Per-file edits are listed in EDITS and, with
// the reason, in docs/PATCHES.md (上游測試移植). Usage: node tools/port-upstream-tests.mjs <upstream-root>
// Needs Node >= 22.13. Dev tool; excluded from release.
import { stripTypeScriptTypes } from 'node:module';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const upstream = process.argv[2];
if (!upstream) {
  console.error('usage: node tools/port-upstream-tests.mjs <upstream-root>');
  process.exit(2);
}
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'tests', 'browser', 'upstream');

/** Not ported (spec §9.2): seo checks upstream's index.html, which this module does not use. */
const SKIP = new Set(['unit/seo.test.ts']);

/** Edits for one file: [search, replace] on the stripped source; each must match (the tool fails otherwise). */
const EDITS = {
  // P1-3: the module's own storage key
  'tests/unit/pattern-store.test.ts': [
    [/toBe\('deid\.patternConfig\.v1'\)/, "toBe('jill_deid.patternConfig.v1')"],
  ],
  // P1-5: built-in rule 16 (url) in 國際與通用格式; P1-12: the 測試網址 box after the groups;
  // spec §4: headings shifted down two levels for the theme (h3 → h5)
  'tests/unit/patterns-view.test.ts': [
    [/\['台灣格式（7）', '國際與通用格式（8）', '自訂規則（0）'\]/, "['台灣格式（7）', '國際與通用格式（9）', '自訂規則（0）', '測試網址']"],
    [/'ipv6', 'dob'\]/g, "'ipv6', 'dob', 'ip-net']"],
    [/'\.form-card h3'/g, "'.form-card h5'"],
  ],
  // P0-2: numeric cells are read now (rosters keep 學號 and 座號 as numbers), so the raw phone 912345678 is in the text
  'tests/integration/roundtrip-xlsx.test.ts': [
    [/expect\(doc\.text\)\.not\.toContain\('912345678'\);/, "expect(doc.text).toContain('912345678');"],
    [/'林美玲\\tB223456782\\t新北市/, "'林美玲\\tB223456782\\t912345678\\t新北市"],
  ],
  'tests/integration/roundtrip-realistic.test.ts': [ // P0-2: the numeric 累計消費 column is read now
    [/expect\(originalDoc\.text\)\.not\.toContain\(String\(v\)\);/, 'expect(originalDoc.text).toContain(String(v));'],
  ],
  // Upstream runs Node's Tesseract once per page (a temp lang dir, Buffer). In the browser that single pass reads the
  // sample less well (84.7% of the planted values, SC-002 wants 90%), so the sample is recognised the way the site
  // does it: parsePdf with OCR (recognizePdf, with its Chinese second opinion; 95.1%). Thresholds unchanged.
  'tests/integration/roundtrip-ocr.test.ts': [
    [/import \{ copyFileSync, mkdtempSync, readFileSync \} from 'node:fs';/, "import { readFileSync } from 'node:fs';"],
    [/import \{ tmpdir \} from 'node:os';\n/, ''],
    [/import \{ join \} from 'node:path';\n/, ''],
    [/function langDir\(\)[^]*?\n\}\n/, ''],
    [/ {2}\/\/ Same languages, engine mode[^]*?scanned = assemblePdf\('scanned\.pdf', pages, true\);/,
      // the site's own OCR; then text-only pages as upstream builds them (its fixture has no pictures, rules or fills)
      "  const site = await parsePdf(new File([SAMPLE], 'scanned.pdf'), { ocr: {} }); // jill_deid port\n"
      + "  scanned = assemblePdf('scanned.pdf', site.handle.pages.map((pg) => ({ width: pg.width, height: pg.height, items: pg.items })), true);"],
    // The site's second opinion leaves whitespace-only runs (" "), invisible, that FR-012's check would count as
    // running into the next word; visible runs are still checked in full.
    [/for \(const \{ items: runs \} of \(out\.handle\s*\)\.pages\) \{/,
      'for (const { items: drawn } of out.handle.pages) {\n      const runs = drawn.filter((r) => r.text.trim()); // jill_deid port'],
  ],
};

const VENDOR = 'assets/vendor/';
/** scripts/lib files the tests import (the sample-document generators); render-scan needs puppeteer and is not one. */
const SCRIPTS = ['docmodel.ts', 'fake.ts', 'documents.ts', 'render-docx.ts', 'render-pdf.ts'];

/** Upstream path (posix, from its root) of a ported file → its path under this module. */
function target(up) {
  const p = up.replace(/\.ts$/, '');
  if (p.startsWith('src/')) {
    const rest = p.slice(4);
    return `assets/js/upstream/${existsSync(join(upstream, 'src', rest)) ? `${rest}/index` : rest}.js`; // src/formats → formats/index
  }
  if (p.startsWith('tests/')) return `tests/browser/upstream/${p.slice(6)}.js`;
  if (p.startsWith('scripts/lib/')) return `tests/browser/upstream/${p}.js`;
  throw new Error(`no target for ${up}`);
}
const relFrom = (fromUp, to) => {
  const r = posix.relative(posix.dirname(target(fromUp)), to);
  return r.startsWith('.') ? r : `./${r}`;
};

function port(up, source) {
  const ts = source.replace(/\r\n/g, '\n'); // a Windows checkout has CRLF
  let s;
  try {
    s = stripTypeScriptTypes(ts, { mode: 'strip' });
  } catch {
    s = stripTypeScriptTypes(ts, { mode: 'transform' }); // parameter properties (scripts/lib/render-pdf.ts)
  }
  for (const [re, to] of EDITS[up] ?? []) {
    if (!re.test(s)) throw new Error(`${up}: edit ${re} no longer matches`);
    s = s.replace(re, to);
  }
  const fresh = /vi\.resetModules\(\)/.test(s);
  const shim = relFrom(up, 'tests/browser/upstream/vitest-shim.js');
  const vendor = (f) => relFrom(up, VENDOR + f);
  /** a relative specifier in the upstream tree → the converted file's path from this file */
  const mapRel = (spec) => relFrom(up, target(posix.normalize(posix.join(posix.dirname(up), spec)).replace(/\.ts$/, '') + '.ts'));
  s = s
    .replace(/from '(\.\.?\/[^']+)'/g, (_, spec) => `from '${mapRel(spec)}'`) // first: the rest add relative paths
    .replace(/from 'vitest'/g, `from '${shim}'`)
    .replace(/from 'node:fs'/g, `from '${shim}'`)
    .replace(/^import \{ pathToFileURL \} from 'node:url';\n/m, '')
    .replace(/^.*GlobalWorkerOptions\.workerSrc = .*\n/gm, '') // P1-1: pdf.js runs on the module's own workerPort
    .replace(/from 'pdfjs-dist'/g, `from '${vendor('pdf.min.js')}'`)
    .replace(/from 'pdf-lib'/g, `from '${vendor('pdf-lib.esm.min.js')}'`)
    .replace(/from 'tesseract\.js'/g, `from '${vendor('tesseract.esm.min.js')}'`)
    // UMD vendor files set a global (as tools/strip-upstream.mjs does for src/)
    .replace(/^import JSZip from 'jszip';$/m, `import '${vendor('jszip.min.js')}';\nconst JSZip = globalThis.JSZip;`)
    .replace(/^import fontkit from '@pdf-lib\/fontkit';$/m, `import '${vendor('fontkit.umd.min.js')}';\nconst fontkit = globalThis.fontkit;`)
;
  // vi.resetModules(): a dynamic import of a module becomes a fresh instance per reset
  s = s.replace(/import\('(\.\.?\/[^']+)'\)/g, (_, spec) => (fresh
    ? `import(new URL('${mapRel(spec)}', import.meta.url).href + '?epoch=' + vi.epoch)`
    : `import('${mapRel(spec)}')`));
  const left = s.match(/^import [^\n]*from '(?!\.)[^']+'/gm);
  if (left) throw new Error(`${up}: unmapped imports ${left.join(', ')}`);
  // Buffer.from(bytes).toString('latin1') → the shim's LatinBuffer (a global Buffer would make JSZip think it runs in Node)
  if (/\bBuffer\.from\(/.test(s)) s = `import { LatinBuffer } from '${shim}';\n${s.replace(/\bBuffer\.from\(/g, 'LatinBuffer.from(')}`;
  const head = `// Ported by tools/port-upstream-tests.mjs from upstream ${up}; do not edit (spec §9.2).\n`;
  const scope = /\.test\.ts$/.test(up) ? `import { fileScope } from '${shim}';\nfileScope('${up.replace(/^tests\//, '').replace(/\.ts$/, '')}');\n` : '';
  return head + scope + s;
}

rmSync(out, { recursive: true, force: true });
const files = [];
const write = (up) => {
  const to = join(root, target(up));
  mkdirSync(dirname(to), { recursive: true });
  writeFileSync(to, port(up, readFileSync(join(upstream, up), 'utf8')));
};
for (const f of SCRIPTS) write(`scripts/lib/${f}`);
for (const dir of ['helpers', 'unit', 'integration']) {
  for (const f of readdirSync(join(upstream, 'tests', dir)).filter((x) => x.endsWith('.ts')).sort()) {
    if (SKIP.has(`${dir}/${f}`)) continue;
    write(`tests/${dir}/${f}`);
    if (dir !== 'helpers') files.push(`./${dir}/${f.replace(/\.ts$/, '.js')}`);
  }
}
mkdirSync(join(out, 'fixtures'), { recursive: true });
for (const f of readdirSync(join(upstream, 'tests', 'fixtures'))) copyFileSync(join(upstream, 'tests', 'fixtures', f), join(out, 'fixtures', f));
copyFileSync(join(upstream, 'scripts', 'assets', 'scan', 'ssd-product.jpg'), join(out, 'fixtures', 'ssd-product.jpg'));

// The shim is hand-written and lives next to the ported files: put it back after the clean.
writeFileSync(join(out, 'vitest-shim.js'), readFileSync(join(root, 'tools', 'upstream-tests', 'vitest-shim.js')));
writeFileSync(join(out, 'index.html'), `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>jill_deid upstream tests</title>
<style>
  body { font: 14px/1.5 monospace; margin: 16px; }
  .fail { color: #b00020; }
</style>
</head>
<body>
<p id="summary">running…</p>
<ul id="results"></ul>
<div id="jill-deid-portal"></div>
<script type="module">
  // Generated by tools/port-upstream-tests.mjs. One file at a time: each sets its own hook scope (vitest-shim.js).
  import { run } from '../runner.js';
  for (const f of ${JSON.stringify(files, null, 2).replace(/\n/g, '\n  ')}) await import(f);
  run();
</script>
</body>
</html>
`);
console.log(`ported ${files.length} test files to ${out}`);
