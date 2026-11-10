// One-time conversion of upstream data-deidentification src/**/*.ts into plain ES modules (spec §4).
// Usage: node tools/strip-upstream.mjs <upstream-root> [<out-dir>]
//   <out-dir> defaults to assets/js/upstream next to this tool. Needs Node >= 22.13 (stripTypeScriptTypes).
// Not used at runtime; excluded from release by .gitattributes.
import { stripTypeScriptTypes } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, relative, resolve, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

const [upstream, outArg] = process.argv.slice(2);
if (!upstream) {
  console.error('usage: node tools/strip-upstream.mjs <upstream-root> [<out-dir>]');
  process.exit(2);
}
const srcRoot = resolve(upstream, 'src');
const outRoot = resolve(outArg ?? join(dirname(fileURLToPath(import.meta.url)), '../assets/js/upstream'));

// Package specifier -> replacement. `rel` paths are relative to assets/ and turned into a path
// relative to each output file; `umd` is imported for its side effect (a UMD loaded as a module sets
// globalThis[global], in the page and in a module worker alike), then read from globalThis.
const PACKAGES = {
  'jszip': { umd: 'vendor/jszip.min.js', global: 'JSZip' },
  '@pdf-lib/fontkit': { umd: 'vendor/fontkit.umd.min.js', global: 'fontkit' },
  'libphonenumber-js': { umd: 'vendor/libphonenumber-min.js', global: 'libphonenumber' },
  'pdf-lib': { rel: 'vendor/pdf-lib.esm.min.js' },
  'pdfjs-dist': { rel: 'vendor/pdf.min.js' },
  'tesseract.js': { rel: 'vendor/tesseract.esm.min.js' },
};
const ASSETS_JS = 'js/jill/assets.js';

const walk = (dir) => readdirSync(dir).flatMap((n) => {
  const p = join(dir, n);
  return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : [];
});

let files = 0;
let relFixed = 0;
// Only the libraries; ui/ and main.ts are not brought in (spec §4)
for (const file of ['core', 'formats'].flatMap((d) => walk(join(srcRoot, d)))) {
  const relPath = relative(srcRoot, file).replaceAll('\\', '/').replace(/\.ts$/, '.js');
  const outFile = join(outRoot, relPath);
  // assets/js/upstream/<relPath> -> path back to assets/
  const toAssets = posix.relative(posix.dirname(posix.join('js/upstream', relPath)), '.') || '.';
  const fromAssets = (p) => `${toAssets}/${p}`;

  let js = stripTypeScriptTypes(readFileSync(file, 'utf8'), { mode: 'strip' });

  // Vite-only imports
  js = js.replace(/^import\s+'\.\/styles\.css';\s*$/m, '');
  js = js.replace(
    /^import\s+(\w+)\s+from\s+'pdfjs-dist\/build\/pdf\.worker\.min\.mjs\?url';/m,
    (_, name) => `const ${name} = \`\${assetsBase}vendor/pdf.worker.min.js\`;`,
  );
  const usesBase = /import\.meta\.env\.BASE_URL|\$\{assetsBase\}/.test(js);
  js = js.replaceAll('import.meta.env.BASE_URL', 'assetsBase');

  // Package imports
  js = js.replace(/^import\s+(.+?)\s+from\s+'([^'.][^']*)';/gm, (line, what, spec) => {
    const p = PACKAGES[spec];
    if (!p) throw new Error(`${relPath}: unmapped package import '${spec}'`);
    if (p.rel) return `import ${what} from '${fromAssets(p.rel)}';`;
    // default or namespace import -> the global itself; named imports -> destructure
    const binding = what.replace(/^\*\s+as\s+/, '');
    return `import '${fromAssets(p.umd)}';\nconst ${binding} = globalThis.${p.global};`;
  });
  js = js.replace(/import\('([^'.][^']*)'\)/g, (m, spec) => {
    const p = PACKAGES[spec];
    if (!p?.rel) throw new Error(`${relPath}: unmapped dynamic import '${spec}'`);
    return `import('${fromAssets(p.rel)}')`;
  });

  // Relative specifiers get an explicit file (browsers do no extension or directory-index resolution)
  js = js.replace(/((?:\bfrom\s+|\bimport\s*\(\s*|^import\s+)')(\.\.?\/[^']+?)(?<!\.js)'/gm, (_, pre, spec) => {
    const abs = resolve(dirname(file), spec);
    const target = existsSync(`${abs}.ts`) ? `${spec}.js` : existsSync(join(abs, 'index.ts')) ? `${spec}/index.js` : null;
    if (!target) throw new Error(`${relPath}: cannot resolve '${spec}'`);
    relFixed++;
    return `${pre}${target}'`;
  });

  if (usesBase) js = `import { assetsBase } from '${fromAssets(ASSETS_JS)}';\n${js}`;

  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, js);
  files++;
}
console.log(`converted ${files} files, ${relFixed} relative specifiers -> ${outRoot}`);
