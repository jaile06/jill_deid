// Link targets in Markdown and pasted text (spec §5.5): the URL of [text](url "title"), ![alt](url), [id]: url "title"
// and <a href="…">/src="…". These URLs are never shown, so they are URI positions (spec §5.1): left out of the normal
// text scan and rewritten by scanUri once. Text, alt and title stay in the normal scan. Autolinks <https://…> and bare
// URLs are shown as text and stay text-layer (spec §5.3). Code blocks are scanned like the rest.
// ponytail: regexes, not a CommonMark parser — link text with nested brackets beyond one level is not recognised as a
// link, and its URL then goes through the normal text scan (still masked, just not URI-encoded).
import { applyEdits, applyRedactions, mergeMappings } from '../../upstream/core/redactor.js';

const TITLE = `(?:"[^"\\n]*"|'[^'\\n]*'|\\([^)\\n]*\\))`;
const DEST = '(<[^<>\\n]*>|[^\\s()<>]*(?:\\([^\\s()]*\\)[^\\s()<>]*)*)';
const INLINE = new RegExp(`!?\\[((?:[^\\[\\]\\n]|\\[[^\\[\\]\\n]*\\])*)\\]\\([ \\t]*${DEST}(?:[ \\t]+${TITLE})?[ \\t]*\\)`, 'dg');
const DEFINITION = new RegExp(`^ {0,3}\\[[^\\]\\n]+\\]:[ \\t]*${DEST}(?:[ \\t]+${TITLE})?[ \\t]*$`, 'dgm');
const HTML = /\b(?:href|src)\s*=\s*(?:"([^"]*)"|'([^']*)')/dgi;

/**
 * @typedef {{ id: string, uri: string, start: number, end: number, kind: 'md', form: 'inline'|'definition'|'html',
 *   wrap: [number, number], displayRange?: [number, number], writable: true }} MdLink
 *   [start, end) is the URL in the text (without <>); wrap the whole construct; displayRange the link text or alt
 */

/** Link targets of `text`, by position. */
export function markdownLinks(text) {
  const out = [];
  const add = (m, g, form, display) => {
    let [start, end] = m.indices[g];
    if (text[start] === '<') [start, end] = [start + 1, end - 1];
    if (end > start) out.push({ id: `md${out.length}`, uri: text.slice(start, end), start, end, kind: 'md', form, wrap: m.indices[0], displayRange: display, writable: true });
  };
  for (const m of text.matchAll(INLINE)) add(m, 2, 'inline', m.indices[1]);
  for (const m of text.matchAll(DEFINITION)) add(m, 1, 'definition');
  for (const m of text.matchAll(HTML)) add(m, m[1] === undefined ? 2 : 1, 'html');
  return out.sort((a, b) => a.start - b.start).map((l, i) => ({ ...l, id: `md${i}` }));
}

/** Link targets of a document whose links live in its text (TXT, Markdown, pasted text); cached on the document. */
export function textLinks(doc) {
  if (doc.format !== 'txt' && doc.format !== 'md') return [];
  doc.links ??= markdownLinks(doc.text);
  return doc.links;
}

const inside = (e, ranges) => ranges.some(([s, t]) => e.start < t && e.end > s);

/** Candidates outside every link URL: those are scanned by scanUri instead, so nothing is replaced twice. */
export function outsideLinks(cands, links) {
  const urls = links.map((l) => [l.start, l.end]);
  return urls.length ? cands.filter((c) => !inside(c, urls)) : cands;
}

/**
 * applyRedactions plus the link targets: `decide(uri)` is scanUri with the document's book and current settings.
 * A rewritten URL replaces its range; a stripped link keeps only its text (an inline link or image), or goes
 * entirely (a definition) or is emptied (an HTML attribute). Text edits inside removed parts are dropped.
 * The hits join the mapping table. Returns applyRedactions' fields and `links`: [{ link, decision }].
 */
export function redactWithLinks(text, items, style, links, decide) {
  const base = applyRedactions(text, items, style);
  if (!links.length) return { ...base, links: [] };
  // A manual item inside a URL would collide with its rewrite: such a link is removed instead (fail closed).
  const decided = links.map((link) => ({
    link,
    decision: inside(link, base.edits.map((e) => [e.start, e.end]))
      ? { action: 'strip', hits: [], warnings: ['manual'], unrestorable: true }
      : decide(link.uri),
  }));
  const linkEdits = [];
  const removed = [];
  for (const { link, decision } of decided) {
    if (decision.action === 'rewrite') linkEdits.push({ start: link.start, end: link.end, replacement: decision.uri });
    if (decision.action !== 'strip') continue;
    const cut = link.form === 'inline'
      ? [[link.wrap[0], link.displayRange[0]], [link.displayRange[1], link.wrap[1]]]
      : link.form === 'definition' ? [link.wrap] : [[link.start, link.end]];
    for (const [s, e] of cut) if (e > s) linkEdits.push({ start: s, end: e, replacement: '' });
    removed.push(...cut);
  }
  const edits = [...base.edits.filter((e) => !inside(e, removed)), ...linkEdits].sort((a, b) => a.start - b.start);
  const mapping = mergeMappings(base.mapping, decided.flatMap(({ decision }) => decision.hits));
  return { redactedText: applyEdits(text, edits), edits, mapping: style === 'code' ? mapping : [], links: decided };
}
