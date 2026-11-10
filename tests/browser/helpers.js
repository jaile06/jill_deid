// Shared by test pages: de-identify a file as the processing page does (部分保留, code, mask_pii_in_url).
import { BUILTIN_PATTERNS } from '../../assets/js/upstream/core/patterns.js';
import { CodeBook } from '../../assets/js/upstream/core/codes.js';
import { resplitItems } from '../../assets/js/upstream/core/detector.js';
import { applyRedactions } from '../../assets/js/upstream/core/redactor.js';
import { serializeMapping } from '../../assets/js/upstream/core/csv.js';
import { generateDocument, parseDocument } from '../../assets/js/upstream/formats/index.js';
import { detectDocument, detectShort } from '../../assets/js/jill/detect.js';
import { scanUri } from '../../assets/js/jill/uri-scan.js';
import { redactWithLinks, textLinks } from '../../assets/js/jill/links/markdown.js';
import { redactLinks } from '../../assets/js/jill/links/rels.js';

export const PREVIEW = { mode: 'preview' };
export const sid = { id: 'org-1', category: '學號', regex: '(?<=[?&]sid=)[^&#\\s]+', enabled: true, applyToUrl: true, source: 'org' };
export const PATTERNS = [...BUILTIN_PATTERNS, sid];

/** De-identify as the processing page does (部分保留, code, mask_pii_in_url) and return the output file + CSV text. */
export async function deidentify(file) {
  const doc = await parseDocument(file);
  const book = new CodeBook();
  const { items } = await detectDocument(doc, PATTERNS, book);
  resplitItems(items, book, () => PREVIEW);
  const decide = (uri) => scanUri(uri, PATTERNS, book, { retentionOf: () => PREVIEW });
  const scan = (s) => {
    const it = detectShort(s, PATTERNS, book);
    resplitItems(it, book, () => PREVIEW);
    return applyRedactions(s, it);
  };
  const r = ['docx', 'xlsx', 'pdf'].includes(doc.format)
    ? redactLinks(doc.links ?? [], applyRedactions(doc.text, items), 'code', decide, scan)
    : redactWithLinks(doc.text, items, 'code', textLinks(doc), decide);
  const out = new File([await generateDocument(doc, r.edits, r.links)], file.name.replace(/(\.[^.]+)$/, '.deid$1'));
  return { doc, r, out, csv: serializeMapping(r.mapping) };
}

