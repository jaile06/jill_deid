// Shared by DOCX and XLSX (spec §5.5): External targets in *.rels, one link per reference to the rId; document
// properties; the processing page's decision for each link. Format specifics (Word fields, Excel formulas and
// internal hyperlinks) live in links/docx.js and links/xlsx.js.
import { mergeMappings } from '../../upstream/core/redactor.js';

export const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PR = 'http://schemas.openxmlformats.org/package/2006/relationships';
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const S = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';

export const parse = (xml) => new DOMParser().parseFromString(xml, 'application/xml');
export const serialize = (doc) => {
  const xml = new XMLSerializer().serializeToString(doc);
  return xml.startsWith('<?xml') ? xml : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n${xml}`;
};
export const all = (doc) => [...doc.getElementsByTagName('*')];
/** xl/worksheets/_rels/sheet1.xml.rels → xl/worksheets/sheet1.xml; _rels/.rels → '' (the package) */
const ownerOf = (relsPath) => relsPath.replace(/(^|\/)_rels\/([^/]*)\.rels$/, '$1$2');

/** rId → elements referring to it (any r: attribute), in document order */
function refMap(doc) {
  const map = new Map();
  for (const el of all(doc)) {
    for (const a of el.attributes) if (a.namespaceURI === R) map.set(a.value, [...(map.get(a.value) ?? []), el]);
  }
  return map;
}

/**
 * Links of every External relationship. `docs`: path → parsed Document of the text parts (sheets, Word parts);
 * other owners are read from the zip and kept in `pristine` with the *.rels, so each download starts from the
 * original. `describe(owner, el)` gives a reference's { displayRange?, texts? } (texts: attributes for the normal
 * scan, [{ ns, name, value }]).
 */
export async function relsLinks(zip, docs, pristine, describe) {
  const links = [];
  for (const relsPath of Object.keys(zip.files).filter((p) => p.endsWith('.rels')).sort()) {
    const xml = await zip.file(relsPath).async('string');
    const external = [...parse(xml).getElementsByTagNameNS(PR, 'Relationship')].filter((r) => r.getAttribute('TargetMode') === 'External');
    if (!external.length) continue;
    pristine.set(relsPath, xml);
    const owner = ownerOf(relsPath);
    let ownerDoc = docs.get(owner);
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
        writable: true, ...(el ? describe(owner, el) : {}),
      }));
    }
  }
  return links;
}

/** Attribute texts of `el` that exist, as [{ ns, name, value }]. */
export const attrTexts = (el, names) => names.flatMap(([ns, name]) => {
  const local = name.replace(/^.*:/, '');
  return el.hasAttributeNS(ns, local) ? [{ ns, name, value: el.getAttributeNS(ns, local) }] : [];
});
export function setTexts(el, texts, values) {
  texts?.forEach((t, i) => {
    if (values?.[i] !== undefined) el.setAttributeNS(t.ns, t.name, values[i]);
  });
}

export function unwrap(el) {
  while (el.firstChild) el.parentNode.insertBefore(el.firstChild, el);
  el.remove();
}
/** Removes an element and its container when that is left empty (an empty <hyperlinks/> is invalid). */
export function removeWithEmptyParent(el) {
  const parent = el.parentNode;
  el.remove();
  if (parent && parent.children.length === 0 && parent.parentNode && parent.parentNode.nodeType === 1) parent.remove();
}
/** Removes the link structure at a reference; the text it covers stays. */
function stripRef(el, rId) {
  if (el.namespaceURI === W && el.localName === 'hyperlink') return unwrap(el);
  if (el.namespaceURI === S && el.localName === 'hyperlink') return removeWithEmptyParent(el);
  if (el.namespaceURI === A && /^hlink/.test(el.localName)) return el.remove();
  for (const a of [...el.attributes]) if (a.namespaceURI === R && a.value === rId) el.removeAttributeNode(a);
}

/**
 * Writes decided rels links (`decided`: [{ link, decision }]) into the clones (path → Document) and the zip.
 * References of one rId with different outcomes get their own relationship (H7). Owners that are not clones are
 * parsed from `pristine` and written back. Returns that map of owner documents, so callers can do more on them.
 */
export function writeRelsLinks(zip, clones, pristine, decided) {
  const docs = new Map(clones);
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
      let first = true;
      for (const [, same] of Map.groupBy(group, ({ decision: d }) => (d.action === 'rewrite' ? `rewrite ${d.uri}` : d.action))) {
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
        const mine = same.map(({ link }) => els[link.ref]);
        for (const el of mine.filter(Boolean)) for (const a of el.attributes) if (a.namespaceURI === R && a.value === rId) a.value = id;
        if (d.action === 'rewrite') target.setAttribute('Target', d.uri);
        if (d.action === 'strip') {
          for (const el of mine.filter(Boolean)) stripRef(el, id);
          target.remove(); // every reference to it was in this group
        } else {
          same.forEach(({ link, decision }, i) => mine[i] && setTexts(mine[i], link.texts, decision.texts));
        }
      }
    }
    zip.file(relsPath, serialize(relsDoc));
  }
  for (const [path, doc] of docs) if (!clones.has(path)) zip.file(path, serialize(doc));
  return docs;
}

/** Author, last editor, company and the free-form custom properties (spec §5.5 DOCX 7, XLSX 4). */
export async function scrubProps(zip) {
  const clear = (names) => (doc) => {
    for (const el of all(doc)) if (names.includes(el.localName)) el.textContent = '';
  };
  await editXml(zip, 'docProps/core.xml', clear(['creator', 'lastModifiedBy']));
  await editXml(zip, 'docProps/app.xml', clear(['Company', 'Manager']));
  await editXml(zip, 'docProps/custom.xml', (doc) => { // property names are free-form: every value goes (fail closed)
    for (const p of all(doc)) if (p.localName === 'property') for (const v of p.children) v.textContent = '';
  });
}
export async function editXml(zip, path, fn) {
  const file = zip.file(path);
  if (!file) return;
  const doc = parse(await file.async('string'));
  fn(doc);
  zip.file(path, serialize(doc));
}

const KEEP = { action: 'keep', hits: [], warnings: [], unrestorable: false };
/**
 * The processing page's decision for each link: scanUri on its target (`decide`; links without one are kept) and
 * the normal scan of its texts (`plain`: text → { redactedText, mapping }), whose codes join the mapping table.
 */
export function redactLinks(links, base, style, decide, plain) {
  const decided = links.map((link) => {
    const decision = link.uri == null ? { ...KEEP } : { ...decide(link.uri) };
    if (link.texts?.length) {
      const scanned = link.texts.map((t) => plain(t.value));
      decision.texts = scanned.map((s) => s.redactedText);
      decision.textMapping = scanned.flatMap((s) => s.mapping);
    }
    return { link, decision };
  });
  const mapping = mergeMappings(base.mapping, ...decided.map(({ decision: d }) => [...d.hits, ...(d.textMapping ?? [])]));
  return { ...base, mapping: style === 'code' ? mapping : [], links: decided };
}
