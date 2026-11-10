// DOCX link targets and residue (spec §5.5 DOCX 1–8). formats/docx.js calls docxLinks() when parsing and
// writeDocxLinks() + scrubDocx() when generating; the processing page decides each link (rels.js redactLinks).
// Links live outside the text: in *.rels (links/rels.js) and in HYPERLINK field codes (w:instrText split over runs,
// w:fldSimple). Texts scanned normally: a hyperlink's w:tooltip, a field's \o switch.
import { applyEdits } from '../../upstream/core/redactor.js';
import { all, attrTexts, editXml, relsLinks, scrubProps, unwrap, writeRelsLinks } from './rels.js';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const MC = 'http://schemas.openxmlformats.org/markup-compatibility/2006';
const W15 = 'http://schemas.microsoft.com/office/word/2012/wordml';
const XML_NS = 'http://www.w3.org/XML/1998/namespace';

/** Text range of the parsed part's <w:t> nodes for which `inside` holds. */
function rangeOf(part, inside) {
  const idx = part.nodes.flatMap((n, i) => (inside(n) ? [i] : []));
  return idx.length ? [part.segments[idx[0]].start, part.segments[idx.at(-1)].end] : undefined;
}

/** Tokens of a field instruction: quoted strings or words, with their span. */
const tokens = (instr) => [...instr.matchAll(/"([^"]*)"|(\S+)/dg)].map((m) => ({ value: m[1] ?? m[2], span: m.indices[0] }));

/** { url, tooltip } tokens of a HYPERLINK instruction; null for other fields and internal (\l only) links. */
export function parseHyperlink(instr) {
  const t = tokens(instr);
  if (!/^HYPERLINK$/i.test(t[0]?.value ?? '')) return null;
  let url = null;
  let tooltip = null;
  for (let i = 1; i < t.length; i++) {
    const sw = /^\\([a-z])$/i.exec(t[i].value)?.[1]?.toLowerCase();
    if (sw === 'l' || sw === 't') i++; // switch with an argument we leave alone
    else if (sw === 'o') tooltip = t[++i] ?? null;
    else if (!sw && !url) url = t[i];
  }
  return url ? { url, tooltip } : null;
}

/** HYPERLINK fields of a part in document order: complex (fldChar … instrText … separate … end) and simple. */
function fieldsOf(doc) {
  const out = [];
  const stack = [];
  for (const el of all(doc)) {
    if (el.namespaceURI !== W) continue;
    if (el.localName === 'fldSimple') {
      const h = parseHyperlink(el.getAttributeNS(W, 'instr') ?? '');
      if (h) out.push({ simple: el, instr: el.getAttributeNS(W, 'instr'), ...h });
    } else if (el.localName === 'fldChar') {
      const type = el.getAttributeNS(W, 'fldCharType');
      if (type === 'begin') stack.push({ instrNodes: [], runs: [el.parentNode], sep: null });
      const top = stack.at(-1);
      if (!top) continue;
      if (type === 'separate') {
        top.sep = el;
        top.runs.push(el.parentNode);
      }
      if (type === 'end') {
        stack.pop();
        top.end = el;
        top.runs.push(el.parentNode);
        top.instr = top.instrNodes.map((n) => n.textContent).join('');
        const h = parseHyperlink(top.instr);
        if (h) out.push({ ...top, ...h });
      }
    } else if (el.localName === 'instrText' && stack.length && !stack.at(-1).sep) {
      stack.at(-1).instrNodes.push(el);
      stack.at(-1).runs.push(el.parentNode);
    }
  }
  return out;
}

const after = (a, b) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

/**
 * Link targets of a parsed DOCX; `pristine` receives the original XML they live in (see relsLinks).
 * @returns {Promise<object[]>} links: { id, kind: 'rels'|'field', uri, displayRange?, texts?, writable, … }
 */
export async function docxLinks(zip, parts, pristine) {
  const byPath = new Map(parts.map((p) => [p.path, p]));
  const links = await relsLinks(zip, new Map(parts.map((p) => [p.path, p.doc])), pristine, (owner, el) => ({
    displayRange: byPath.has(owner) ? rangeOf(byPath.get(owner), (n) => el.contains(n)) : undefined,
    texts: attrTexts(el, [[W, 'w:tooltip']]),
  }));
  for (const part of parts) {
    fieldsOf(part.doc).forEach((f, field) => links.push({
      id: `field:${part.path}#${field}`, kind: 'field', uri: f.url.value, part: part.path, field,
      displayRange: f.simple ? rangeOf(part, (n) => f.simple.contains(n)) : rangeOf(part, (n) => f.sep && after(f.sep, n) && after(n, f.end)),
      texts: f.tooltip ? [{ name: '\\o', value: f.tooltip.value }] : [], writable: true,
    }));
  }
  return links;
}

/** Writes the decided links ([{ link, decision }]) into the cloned parts (path → Document) and the zip. */
export function writeDocxLinks(zip, clones, pristine, decided) {
  const docs = writeRelsLinks(zip, clones, pristine, decided);
  for (const [path, list] of Map.groupBy(decided.filter((d) => d.link.kind === 'field'), (d) => d.link.part)) {
    const fields = fieldsOf(docs.get(path));
    for (const { link, decision: d } of list) {
      const f = fields[link.field];
      if (!f) continue;
      if (d.action === 'strip') {
        if (f.simple) unwrap(f.simple);
        else for (const run of new Set(f.runs)) run.remove();
        continue;
      }
      const quote = (s) => `"${s.replace(/"/g, '')}"`;
      const edits = [];
      if (d.action === 'rewrite') edits.push({ start: f.url.span[0], end: f.url.span[1], replacement: quote(d.uri) });
      if (f.tooltip && d.texts?.[0] !== undefined) edits.push({ start: f.tooltip.span[0], end: f.tooltip.span[1], replacement: quote(d.texts[0]) });
      if (!edits.length) continue;
      const instr = applyEdits(f.instr, edits);
      if (f.simple) f.simple.setAttributeNS(W, 'w:instr', instr);
      else {
        f.instrNodes.forEach((n, i) => {
          n.textContent = i === 0 ? instr : '';
          n.setAttributeNS(XML_NS, 'xml:space', 'preserve');
        });
      }
    }
  }
}

/**
 * Residue upstream leaves (spec §5.5 DOCX 6–8, H15): the mc:Fallback copy of text boxes, tracked deletions and
 * moves, reviewer names on revisions and comments, people.xml, and the document properties.
 */
export async function scrubDocx(zip, clones, { keepProps = false } = {}) {
  for (const doc of clones.values()) {
    for (const el of all(doc)) {
      if ((el.namespaceURI === MC && el.localName === 'Fallback') || (el.namespaceURI === W && (el.localName === 'del' || el.localName === 'moveFrom'))) {
        el.remove();
        continue;
      }
      for (const name of ['author', 'initials']) if (el.hasAttributeNS(W, name)) el.setAttributeNS(W, `w:${name}`, '');
    }
  }
  await editXml(zip, 'word/people.xml', (doc) => {
    for (const p of doc.getElementsByTagNameNS(W15, 'person')) if (p.hasAttributeNS(W15, 'author')) p.setAttributeNS(W15, 'w15:author', '');
    for (const el of [...doc.getElementsByTagNameNS(W15, 'presenceInfo')]) el.remove();
  });
  if (!keepProps) await scrubProps(zip); // the page may keep document properties (spec §5.5 DOCX 7)
}
