// Phase 1b: calls the upstream libraries directly inside the themed page to verify the five formats
// and OCR (spec §8). Phase 4 replaces this file with the real interface.
import { ACCEPT_ATTR, generateDocument, outputFileName, parseDocument } from '../upstream/formats/index.js';
import { detect } from '../upstream/core/detector.js';
import { BUILTIN_PATTERNS } from '../upstream/core/patterns.js';
import { buildEdits } from '../upstream/core/redactor.js';

const app = document.getElementById('jill-deid-app');
const input = app.querySelector('#jill-deid-smoke-file');
const ocr = app.querySelector('#jill-deid-smoke-ocr');
const rows = app.querySelector('tbody');
const tpl = app.querySelector('#jill-deid-smoke-row');
input.accept = ACCEPT_ATTR;

input.addEventListener('change', async () => {
  for (const file of input.files) {
    const row = tpl.content.firstElementChild.cloneNode(true);
    const [name, format, chars, items, ms, out] = row.children;
    name.textContent = file.name;
    rows.append(row);
    const t0 = performance.now();
    try {
      const onProgress = (p) => (ms.textContent = `${Math.round(p.progress * 100)}%`);
      const doc = await parseDocument(file, ocr.checked ? { ocr: { onProgress } } : {});
      const found = detect(doc.text, BUILTIN_PATTERNS);
      const blob = await generateDocument(doc, buildEdits(found));
      format.textContent = doc.ocr ? `${doc.format}+ocr` : doc.format;
      chars.textContent = String(doc.text.length);
      items.textContent = String(found.length);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = outputFileName(file.name, 'deid');
      a.textContent = a.download;
      out.append(a);
    } catch (e) {
      out.textContent = e.message; // upstream messages are shown as-is (spec §4 i18n)
    }
    ms.textContent = String(Math.round(performance.now() - t0));
  }
  input.value = '';
});
