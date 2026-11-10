// DOCX link targets and residue (spec §5.5 DOCX 1–8). formats/docx.js calls docxLinks() when parsing and
// writeDocxLinks() + scrubDocx() when generating; the processing page decides each link with scanUri
// (redactDocxLinks). Links live outside the text: in *.rels (External targets, one link per reference to the rId)
// and in HYPERLINK field codes (w:instrText split over runs, w:fldSimple).
import { applyEdits, mergeMappings } from '../../upstream/core/redactor.js';

const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PR = 'http://schemas.openxmlformats.org/package/2006/relationships';
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const MC = 'http://schemas.openxmlformats.org/markup-compatibility/2006';
const W15 = 'http://schemas.microsoft.com/office/word/2012/wordml';
const XML_NS = 'http://www.w3.org/XML/1998/namespace';

const parse = (xml) => new DOMParser().parseFromString(xml, 'application/xml');
const serialize = (doc) => {
  const xml = new XMLSerializer().serializeToString(doc);
  return xml.startsWith('<?xml') ? xml : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n${xml}`;
};
const all = (doc) => [...doc.getElementsByTagName('*')];
/** word/_rels/document.xml.rels → word/document.xml; _rels/.rels → '' (the package) */
const ownerOf = (relsPath) => relsPath.replace(/(^|\/)_rels\/([^/]*)\.rels$/, '$1$2');

/** rId → elements referring to it (any r: attribute), in document order */
function refMap(doc) {
  const map = new Map();
  for (const el of all(doc)) {
    for (const a of el.attributes) if (a.namespaceURI === R) map.set(a.value, [...(map.get(a.value) ?? []), el]);
  }
  return map;
}

/** Text range of the <w:t> nodes inside `el` (or between two nodes), from the parsed part. */
function rangeOf(part, inside) {
  const idx = part.nodes.flatMap((n, i) => (inside(n) ? [i] : []));
  return idx.length ? [part.segments[idx[0]].start, part.segments[idx.at(-1)].end] : undefined;
}

/** Tokens of a field instruction: quoted strings or words, with their span. */
const tokens = (instr) => [...instr.matchAll(/"([^"]*)"|(\S+)/dg)].map((m) => ({ value: m[1] ?? m[2], span: m.indices[0], quoted: m[1] !== undefined }));

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
 * Link targets of a parsed DOCX. `pristine` receives the original XML of every *.rels and of owners that are not
 * text parts, so each download starts from the original (spec §5.5 DOCX 1–3).
 * @returns {Promise<object[]>} links: { id, kind: 'rels'|'field', uri, displayRange?, tooltip?, writable, … }
 */
export async function docxLinks(zip, parts, pristine) {
  const links = [];
  const byPath = new Map(parts.map((p) => [p.path, p]));
  for (const relsPath of Object.keys(zip.files).filter((p) => p.endsWith('.rels')).sort()) {
    const xml = await zip.file(relsPath).async('string');
    const external = [...parse(xml).getElementsByTagNameNS(PR, 'Relationship')].filter((r) => r.getAttribute('TargetMode') === 'External');
    if (!external.length) continue;
    pristine.set(relsPath, xml);
    const owner = ownerOf(relsPath);
    const part = byPath.get(owner);
    let ownerDoc = part?.doc;
    if (!ownerDoc && owner.endsWith('.xml') && zip.file(owner)) {
      pristine.set(owner, await zip.file(owner).async('string'));
      ownerDoc = parse(pristine.get(owner));
    }
    const refs = ownerDoc ? refMap(ownerDoc) : new Map();
    for (const rel of external) {
      const rId = rel.getAttribute('Id');
      const els = refs.get(rId) ?? [];
      (els.length ? els : [null]).forEach((el, ref) => links.push({
        id: `rels:${relsPath}#${rId}#${ref}`, kind: 'rels', uri: rel.getAttribute('Target') ?? '', rels: relsPath, owner, rId, ref,
        displayRange: el && part ? rangeOf(part, (n) => el.contains(n)) : undefined,
        tooltip: el?.getAttributeNS(W, 'tooltip') || undefined, writable: true,
      }));
    }
  }
  for (const part of parts) {
    fieldsOf(part.doc).forEach((f, field) => links.push({
      id: `field:${part.path}#${field}`, kind: 'field', uri: f.url.value, part: part.path, field,
      displayRange: f.simple ? rangeOf(part, (n) => f.simple.contains(n)) : rangeOf(part, (n) => f.sep && after(f.sep, n) && after(n, f.end)),
      tooltip: f.tooltip?.value, writable: true,
    }));
  }
  return links;
}

/** Keeps the children of `el` in its place. */
function unwrap(el) {
  while (el.firstChild) el.parentNode.insertBefore(el.firstChild, el);
  el.remove();
}
/** Removes the link structure at a reference: a hyperlink keeps its runs, a drawing click goes, other refs lose the attribute. */
function stripRef(el, rId) {
  if (el.namespaceURI === W && el.localName === 'hyperlink') return unwrap(el);
  if (el.namespaceURI === A && /^hlink/.test(el.localName)) return el.remove();
  for (const a of [...el.attributes]) if (a.namespaceURI === R && a.value === rId) el.removeAttributeNode(a);
}

/**
 * Writes the decided links into the cloned text parts (`clones`: path → Document) and the zip.
 * `decided`: [{ link, decision }] as from redactDocxLinks; a decision may carry `tooltip` (redacted text).
 * References of one rId with different decisions get their own relationship (H7).
 */
export function writeDocxLinks(zip, clones, pristine, decided) {
  const docs = new Map(clones); // owners that are not text parts are parsed on demand and written back
  const docOf = (path) => {
    if (!docs.has(path) && pristine.has(path)) docs.set(path, parse(pristine.get(path)));
    return docs.get(path);
  };
  const byRels = Map.groupBy(decided.filter((d) => d.link.kind === 'rels'), (d) => d.link.rels);
  for (const [relsPath, list] of byRels) {
    const relsDoc = parse(pristine.get(relsPath));
    const owner = list[0].link.owner;
    const ownerDoc = owner ? docOf(owner) : null;
    const refs = ownerDoc ? refMap(ownerDoc) : new Map();
    const ids = new Set([...relsDoc.getElementsByTagNameNS(PR, 'Relationship')].map((r) => r.getAttribute('Id')));
    let seq = 1;
    const newId = () => {
      while (ids.has(`rIdDeid${seq}`)) seq++;
      ids.add(`rIdDeid${seq}`);
      return `rIdDeid${seq}`;
    };
    for (const [rId, group] of Map.groupBy(list, (d) => d.link.rId)) {
      const rel = [...relsDoc.getElementsByTagNameNS(PR, 'Relationship')].find((r) => r.getAttribute('Id') === rId);
      const els = refs.get(rId) ?? [];
      const original = rel.cloneNode(true); // copies start from the original target, not the first group's rewrite
      const byOutcome = Map.groupBy(group, ({ decision: d }) => (d.action === 'rewrite' ? `rewrite ${d.uri}` : d.action));
      let first = true;
      for (const [, same] of byOutcome) {
        const d = same[0].decision;
        let target = rel;
        let id = rId;
        if (!first) { // H7: a copy of the relationship for these references
          target = original.cloneNode(true);
          id = newId();
          target.setAttribute('Id', id);
          relsDoc.documentElement.append(target); // not rel.after(): rel may already be removed by a strip
        }
        first = false;
        const mine = same.map(({ link }) => els[link.ref]).filter(Boolean);
        for (const el of mine) for (const a of el.attributes) if (a.namespaceURI === R && a.value === rId) a.value = id;
        if (d.action === 'rewrite') target.setAttribute('Target', d.uri);
        if (d.action === 'strip') {
          for (const el of mine) stripRef(el, id);
          target.remove(); // every reference to it was in this group
        } else {
          for (const [i, { decision }] of same.entries()) if (decision.tooltip !== undefined && mine[i]) mine[i].setAttributeNS(W, 'w:tooltip', decision.tooltip);
        }
      }
    }
    zip.file(relsPath, serialize(relsDoc));
  }

  for (const [path, list] of Map.groupBy(decided.filter((d) => d.link.kind === 'field'), (d) => d.link.part)) {
    const fields = fieldsOf(docOf(path));
    for (const { link, decision: d } of list) {
      const f = fields[link.field];
      if (!f) continue;
      if (d.action === 'strip') {
        if (f.simple) unwrap(f.simple);
        else for (const run of new Set(f.runs)) run.remove();
        continue;
      }
      const edits = [];
      const quote = (s) => `"${s.replace(/"/g, '')}"`;
      if (d.action === 'rewrite') edits.push({ start: f.url.span[0], end: f.url.span[1], replacement: quote(d.uri) });
      if (d.tooltip !== undefined && f.tooltip) edits.push({ start: f.tooltip.span[0], end: f.tooltip.span[1], replacement: quote(d.tooltip) });
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
  for (const [path, doc] of docs) if (!clones.has(path)) zip.file(path, serialize(doc));
}

/**
 * Residue upstream leaves (spec §5.5 DOCX 6–8, H15): the mc:Fallback copy of text boxes, tracked deletions and
 * moves, reviewer names on revisions and comments, people.xml, and the document properties.
 */
export async function scrubDocx(zip, clones) {
  for (const doc of clones.values()) {
    for (const el of all(doc)) {
      if ((el.namespaceURI === MC && el.localName === 'Fallback') || (el.namespaceURI === W && (el.localName === 'del' || el.localName === 'moveFrom'))) {
        el.remove();
        continue;
      }
      for (const name of ['author', 'initials']) if (el.hasAttributeNS(W, name)) el.setAttributeNS(W, `w:${name}`, '');
    }
  }
  const edit = async (path, fn) => {
    const file = zip.file(path);
    if (!file) return;
    const doc = parse(await file.async('string'));
    fn(doc);
    zip.file(path, serialize(doc));
  };
  await edit('word/people.xml', (doc) => {
    for (const p of doc.getElementsByTagNameNS(W15, 'person')) if (p.hasAttributeNS(W15, 'author')) p.setAttributeNS(W15, 'w15:author', '');
    for (const el of [...doc.getElementsByTagNameNS(W15, 'presenceInfo')]) el.remove();
  });
  const clear = (doc, names) => {
    for (const el of all(doc)) if (names.includes(el.localName)) el.textContent = '';
  };
  await edit('docProps/core.xml', (doc) => clear(doc, ['creator', 'lastModifiedBy']));
  await edit('docProps/app.xml', (doc) => clear(doc, ['Company', 'Manager']));
  await edit('docProps/custom.xml', (doc) => { // free-form properties: every value goes (fail closed)
    for (const p of doc.getElementsByTagName('*')) if (p.localName === 'property') for (const v of p.children) v.textContent = '';
  });
}

/**
 * The processing page's decision for each link: scanUri on the target (`decide`), the tooltip through the normal
 * scan (`plain`: text → { redactedText, mapping }). Hits and tooltip codes join the mapping table.
 */
export function redactDocxLinks(links, base, style, decide, plain) {
  const decided = links.map((link) => {
    const decision = { ...decide(link.uri) };
    if (link.tooltip && decision.action !== 'strip') {
      const t = plain(link.tooltip);
      if (t.redactedText !== link.tooltip) {
        decision.tooltip = t.redactedText;
        decision.tooltipMapping = t.mapping;
      }
    }
    return { link, decision };
  });
  const mapping = mergeMappings(base.mapping, ...decided.map(({ decision: d }) => [...d.hits, ...(d.tooltipMapping ?? [])]));
  return { ...base, mapping: style === 'code' ? mapping : [], links: decided };
}
