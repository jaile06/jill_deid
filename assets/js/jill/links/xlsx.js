// XLSX link targets and residue (spec §5.5 XLSX 1–4). formats/xlsx.js calls xlsxLinks() when parsing and
// writeXlsxLinks() + scrubXlsx() when generating; the processing page decides each link (rels.js redactLinks).
//   - <hyperlink r:id> of a sheet: target in the sheet's *.rels (links/rels.js); display, tooltip, location scanned
//   - <hyperlink location> without r:id (inside the workbook): only display, tooltip, location scanned
//   - HYPERLINK("url","name") formulas: url through scanUri; name and the cached <v> scanned; <f> kept
import { all, attrTexts, editXml, relsLinks, scrubProps, setTexts, writeRelsLinks, R } from './rels.js';

const S = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const XML_NS = 'http://www.w3.org/XML/1998/namespace';
const ATTRS = [[null, 'display'], [null, 'tooltip'], [null, 'location']];

/** HYPERLINK with a literal URL and optionally a literal name: their content spans in the formula. */
const FORMULA = /^\s*HYPERLINK\(\s*"((?:[^"]|"")*)"\s*(?:,\s*(?:"((?:[^"]|"")*)"|[^)]*))?\s*\)\s*$/di;
const unquote = (s) => s.replace(/""/g, '"');
const quote = (s) => s.replace(/"/g, '""');
export function parseHyperlinkFormula(f) {
  const m = FORMULA.exec(f);
  if (!m) return null;
  return { url: unquote(m[1]), urlSpan: m.indices[1], name: m[2] === undefined ? undefined : unquote(m[2]), nameSpan: m.indices[2] };
}

const hyperlinks = (doc) => [...doc.getElementsByTagNameNS(S, 'hyperlink')];
const internal = (doc) => hyperlinks(doc).filter((h) => !h.hasAttributeNS(R, 'id'));
const formulaCells = (doc) => [...doc.getElementsByTagNameNS(S, 'c')].flatMap((c) => {
  const f = c.getElementsByTagNameNS(S, 'f')[0];
  const h = f && parseHyperlinkFormula(f.textContent ?? '');
  return h ? [{ c, f, v: c.getElementsByTagNameNS(S, 'v')[0], ...h }] : [];
});

/**
 * Link targets of a parsed workbook. `sheets`: [{ path, doc }]; `cellRange(path, ref)` the text range of a cell.
 * @returns {Promise<object[]>} links: { id, kind: 'rels'|'xlsx-attrs'|'xlsx-formula', uri (null: none), texts, … }
 */
export async function xlsxLinks(zip, sheets, pristine, cellRange) {
  const links = await relsLinks(zip, new Map(sheets.map((s) => [s.path, s.doc])), pristine, (owner, el) => (
    el.namespaceURI === S && el.localName === 'hyperlink'
      ? { displayRange: cellRange(owner, el.getAttribute('ref')), texts: attrTexts(el, ATTRS) }
      : {}));
  if (zip.file(CALC_CHAIN)) { // dropCalcChain may change these: keep the originals for the next download
    for (const path of [CALC_CHAIN, WORKBOOK_RELS, TYPES]) if (zip.file(path)) pristine.set(path, await zip.file(path).async('string'));
  }
  for (const { path, doc } of sheets) {
    internal(doc).forEach((h, index) => {
      const texts = attrTexts(h, ATTRS);
      if (texts.length) links.push({ id: `attrs:${path}#${index}`, kind: 'xlsx-attrs', uri: null, sheet: path, index, displayRange: cellRange(path, h.getAttribute('ref')), texts, writable: true });
    });
    formulaCells(doc).forEach((x, index) => links.push({
      id: `formula:${path}#${index}`, kind: 'xlsx-formula', uri: x.url, sheet: path, index, cell: x.c.getAttribute('r'),
      texts: [{ name: 'name', value: x.name ?? '' }, { name: 'v', value: x.v?.textContent ?? '' }], writable: true,
    }));
  }
  return links;
}

/** A cell as an inline string (the formula goes): a stripped HYPERLINK keeps only what it showed. */
function toInlineString(c, value) {
  for (const child of [...c.children]) if (child.namespaceURI === S && ['f', 'v', 'is'].includes(child.localName)) child.remove();
  c.setAttribute('t', 'inlineStr');
  const doc = c.ownerDocument;
  const is = doc.createElementNS(S, 'is');
  const t = doc.createElementNS(S, 't');
  t.setAttributeNS(XML_NS, 'xml:space', 'preserve');
  t.textContent = value;
  is.append(t);
  c.append(is);
}

const CALC_CHAIN = 'xl/calcChain.xml';
const WORKBOOK_RELS = 'xl/_rels/workbook.xml.rels';
const TYPES = '[Content_Types].xml';
/**
 * A stripped HYPERLINK cell has no formula any more, but calcChain.xml still lists it, and Excel reports the file
 * as damaged. The chain is only a cache Excel rebuilds, so it goes with its relationship and content type.
 */
export async function dropCalcChain(zip) {
  if (!zip.file(CALC_CHAIN)) return;
  zip.remove(CALC_CHAIN);
  await editXml(zip, WORKBOOK_RELS, (doc) => {
    for (const r of [...doc.getElementsByTagName('Relationship')]) if (/\/calcChain$/.test(r.getAttribute('Type') ?? '')) r.remove();
  });
  await editXml(zip, TYPES, (doc) => {
    for (const o of [...doc.getElementsByTagName('Override')]) if (o.getAttribute('PartName') === `/${CALC_CHAIN}`) o.remove();
  });
}

/**
 * Writes the decided links ([{ link, decision }]) into the cloned sheets (path → Document) and the zip.
 * Returns true when a formula was removed (the caller then drops calcChain.xml).
 */
export function writeXlsxLinks(zip, clones, pristine, decided) {
  let formulaRemoved = false;
  const docs = writeRelsLinks(zip, clones, pristine, decided);
  for (const [path, list] of Map.groupBy(decided.filter((d) => d.link.kind !== 'rels'), (d) => d.link.sheet)) {
    const doc = docs.get(path);
    const inner = internal(doc); // before any change: indices are those of the parse
    const formulas = formulaCells(doc);
    for (const { link, decision: d } of list) {
      if (link.kind === 'xlsx-attrs') {
        if (inner[link.index]) setTexts(inner[link.index], link.texts, d.texts);
        continue;
      }
      const x = formulas[link.index];
      if (!x) continue;
      const [name, v] = d.texts ?? [];
      if (d.action === 'strip') {
        toInlineString(x.c, v ?? '');
        formulaRemoved = true;
        continue;
      }
      const edits = [];
      if (d.action === 'rewrite') edits.push({ span: x.urlSpan, text: quote(d.uri) });
      if (x.nameSpan && name !== undefined) edits.push({ span: x.nameSpan, text: quote(name) });
      let f = x.f.textContent;
      for (const e of edits.sort((a, b) => b.span[0] - a.span[0])) f = f.slice(0, e.span[0]) + e.text + f.slice(e.span[1]);
      x.f.textContent = f;
      if (x.v && v !== undefined) x.v.textContent = v; // the cached result: Excel shows it until it recalculates
    }
  }
  return formulaRemoved;
}

/** Comment authors, people of threaded comments, document properties (spec §5.5 XLSX 3–4). */
export async function scrubXlsx(zip, { keepProps = false } = {}) {
  for (const path of Object.keys(zip.files).filter((p) => /^xl\/comments\d*\.xml$/.test(p))) {
    await editXml(zip, path, (doc) => {
      for (const a of doc.getElementsByTagNameNS(S, 'author')) a.textContent = '';
    });
  }
  for (const path of Object.keys(zip.files).filter((p) => /^xl\/persons\/[^/]+\.xml$/.test(p))) {
    await editXml(zip, path, (doc) => {
      for (const p of all(doc)) {
        if (p.localName !== 'person') continue;
        for (const name of ['displayName', 'userId']) if (p.hasAttribute(name)) p.setAttribute(name, '');
      }
    });
  }
  if (!keepProps) await scrubProps(zip);
}

