// Restoring a de-identified document with its mapping table (spec §5.3, H12): the text markers (upstream restore)
// plus the link targets and their texts. Pass the result's `edits` and `links` to generateDocument, as for output.
// PDF links are not rebuilt by de-identification, so there is nothing to restore there (spec §5.5 PDF).
import { restore } from '../../upstream/core/restorer.js';
import { applyEdits } from '../../upstream/core/redactor.js';
import { restoreUri } from '../uri-scan.js';
import { textLinks } from './markdown.js';

/**
 * @param {object} doc a parsed de-identified document (parseDocument)
 * @param {object[]} mapping the mapping table entries (parseMapping(...).entries)
 * @returns {{ restoredText: string, edits: object[], links: object[], restoredCount: number, missingCodes: string[] }}
 */
export function restoreDocument(doc, mapping) {
  const base = restore(doc.text, mapping);
  const missing = new Set(base.missingCodes);
  let restoredCount = base.restoredCount;
  const tally = (r) => {
    restoredCount += r.restoredCount;
    for (const c of r.missingCodes) missing.add(c);
  };

  // Markdown / pasted text: link URLs sit in the text, their markers are percent-encoded
  const urlEdits = textLinks(doc).flatMap((l) => {
    const r = restoreUri(l.uri, mapping);
    tally(r);
    return r.uri === l.uri ? [] : [{ start: l.start, end: l.end, replacement: r.uri }];
  });
  const overlaps = (e) => urlEdits.some((u) => e.start < u.end && e.end > u.start);
  const edits = [...base.edits.filter((e) => !overlaps(e)), ...urlEdits].sort((a, b) => a.start - b.start);

  // DOCX / XLSX: targets in rels, fields and formulas; texts in attributes
  const links = (doc.format === 'docx' || doc.format === 'xlsx' ? doc.links ?? [] : []).map((link) => {
    const r = link.uri == null ? null : restoreUri(link.uri, mapping);
    if (r) tally(r);
    const texts = link.texts?.map((t) => {
      const x = restore(t.value, mapping);
      tally(x);
      return x.restoredText;
    });
    const action = r && r.uri !== link.uri ? 'rewrite' : 'keep';
    return { link, decision: { action, uri: r?.uri, texts, hits: [], warnings: [], unrestorable: false } };
  });

  return { restoredText: applyEdits(doc.text, edits), edits, links, restoredCount, missingCodes: [...missing] };
}
