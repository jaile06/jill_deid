// Personal data inside link targets (spec §5.1–§5.3, docs/marker-in-uri.md). Pure functions: the format writers
// (Phase 3b-2 on) call scanUri for each link and write the decision back; restoreUri undoes it with the mapping.
// ponytail: scanUri runs the rules where it is called (URIs are short); move it into regex.worker.js if a rule pack
// ever needs the watchdog on link targets too.
import { buildMarker } from '../upstream/core/codes.js';
import { resolveOverlaps, scanPattern } from '../upstream/core/detector.js';
import { applyEdits } from '../upstream/core/redactor.js';
import { splitFor } from '../upstream/core/retention.js';
import { URL_CATEGORY, URL_REGEX, trimUrl } from '../upstream/core/patterns.js';

/**
 * @typedef {{ start: number, end: number, ctxStart: number, kind: 'userinfo'|'host'|'path'|'query'|'fragment'|'mailto'|'tel', mail: boolean }} Component
 *   raw [start, end) of a value in the URI; [ctxStart, start) is scanned with it as context (a query's `?key=`)
 * @typedef {{ code: string, category: string, original: string, prefix?: string, suffix?: string }} LinkHit
 *   a mapping-table row (CSV): `original` is the hidden part, decoded (raw for 網址)
 * @typedef {{ action: 'keep'|'rewrite'|'strip', uri?: string, hits: LinkHit[], warnings: string[], unrestorable: boolean }} LinkDecision
 *   warnings: 'undecodable' (a value could not be decoded and was hidden whole), 'marker' (the marker style leaves no
 *   room for a restorable marker, so the link is removed), 'host' (the host itself is personal data)
 */

/** The parts of `uri` to scan (spec §5.1 table); the scheme is never scanned. */
export function components(uri) {
  const out = [];
  const scheme = uri.match(/^([a-z][a-z\d+.-]*):/i);
  const name = scheme?.[1].toLowerCase();
  const mail = name === 'mailto';
  const add = (start, end, kind, ctxStart = start) => {
    if (end > start) out.push({ start, end, ctxStart, kind, mail });
  };
  let i = scheme ? scheme[0].length : 0;
  if (name === 'tel') {
    add(i, uri.length, 'tel');
    return out;
  }
  const hash = uri.indexOf('#', i) < 0 ? uri.length : uri.indexOf('#', i);
  const q = uri.indexOf('?', i);
  const query = q >= 0 && q < hash ? q : hash;
  if (mail) {
    for (const part of uri.slice(i, query).split(',')) {
      add(i, i + part.length, 'mailto');
      i += part.length + 1;
    }
  } else {
    const slashes = uri.startsWith('//', i);
    if (slashes || (!scheme && /^www\./i.test(uri))) {
      if (slashes) i += 2;
      const authEnd = i + uri.slice(i, query).search(/\/|$/);
      const at = uri.lastIndexOf('@', authEnd - 1);
      if (at >= i) {
        add(i, at, 'userinfo');
        i = at + 1;
      }
      const port = uri[i] === '[' ? uri.indexOf(']', i) + 1 : uri.indexOf(':', i);
      add(i, port > i && port < authEnd ? port : authEnd, 'host');
      i = authEnd;
    }
    for (const seg of uri.slice(i, query).split('/')) {
      add(i, i + seg.length, 'path');
      i += seg.length + 1;
    }
  }
  if (query < hash) {
    let at = query; // the '?' or '&' before each pair
    for (const pair of uri.slice(query + 1, hash).split('&')) {
      add(at + 1 + pair.indexOf('=') + 1, at + 1 + pair.length, mail ? 'mailto' : 'query', at);
      at += pair.length + 1;
    }
  }
  add(hash + 1, uri.length, 'fragment');
  return out;
}

const isQuery = (c) => c.ctxStart < c.start; // query pairs, also mailto's ?cc= …: '+' is a space
function decode(raw, plus) {
  try {
    return decodeURIComponent(plus ? raw.replace(/\+/g, ' ') : raw);
  } catch {
    return null; // URIError: e.g. Big5 bytes, or a cut-off %E7%8E
  }
}
function encode(c, s) {
  const e = encodeURIComponent(s);
  return c.mail ? e.replace(/%40/g, '@') : c.kind === 'tel' ? e.replace(/%2B/g, '+') : e;
}

/** Hits of `patterns` in one component, in value offsets; the context only helps lookbehinds. */
function scanComponent(uri, c, patterns) {
  const value = decode(uri.slice(c.start, c.end), isQuery(c));
  if (value === null) return { value };
  const ctx = decode(uri.slice(c.ctxStart, c.start), true) ?? uri.slice(c.ctxStart, c.start);
  const cands = resolveOverlaps(patterns.flatMap((p) => scanPattern(ctx + value, p)))
    .filter((x) => x.end > ctx.length)
    .map((x) => ({ ...x, start: Math.max(x.start, ctx.length) - ctx.length, end: x.end - ctx.length }));
  return { value, cands };
}

/**
 * What to do with one link target. `patterns` as from getEffectivePatterns(); disabled rules and rules with
 * applyToUrl false are left out. `book` is the document's CodeBook, so a value shares its code with the text.
 * @param {string} uri
 * @param {object[]} patterns
 * @param {import('../upstream/core/codes.js').CodeBook} book
 * @param {{ retentionOf?: (cand: object) => object|undefined, hyperlinkMode?: string, markerStyle?: string }} [opts]
 *   retentionOf maps a candidate to its retention under the current output mode (default: the rule's own)
 * @returns {LinkDecision}
 */
export function scanUri(uri, patterns, book, opts = {}) {
  const { retentionOf = (c) => c.retention, hyperlinkMode = 'mask_pii_in_url', markerStyle = 'code' } = opts;
  const active = patterns.filter((p) => p.enabled !== false && p.applyToUrl !== false);
  const hits = [];
  const warnings = [];
  let host = false;
  const hide = (category, original, retention) => {
    const { head, tail } = splitFor(original, retention, category);
    const hit = { code: book.codeFor(category, original, head, tail), category, original: original.slice(head, original.length - tail) };
    if (head) hit.prefix = original.slice(0, head);
    if (tail) hit.suffix = original.slice(original.length - tail);
    hits.push(hit);
    return hit;
  };
  const marker = (h) => encodeURIComponent(buildMarker(h.category, h.code));
  const edits = [];

  // A personal page (rule 16) is hidden as one raw piece: a path keeps its '/' (spec §5.3).
  const pages = resolveOverlaps(active.filter((p) => p.category === URL_CATEGORY).flatMap((p) => scanPattern(uri, p)));
  for (const x of pages) {
    const h = hide(x.category, uri.slice(x.start, x.end), retentionOf(x));
    edits.push({ start: x.start, end: x.end, replacement: (h.prefix ?? '') + marker(h) + (h.suffix ?? '') });
  }
  const others = active.filter((p) => p.category !== URL_CATEGORY);
  for (const c of pages.length ? [] : components(uri)) {
    const { value, cands } = scanComponent(uri, c, others);
    if (value === null) { // fail closed (spec §5.1): the whole value, raw
      warnings.push('undecodable');
      if (c.kind === 'host') host = true;
      else edits.push({ start: c.start, end: c.end, replacement: marker(hide(URL_CATEGORY, uri.slice(c.start, c.end))) });
      continue;
    }
    if (!cands.length) continue; // untouched components keep their bytes
    if (c.kind === 'host') { // no room for a marker in a host
      host = true;
      continue;
    }
    let next = '';
    let at = 0;
    for (const x of cands) {
      const h = hide(x.category, value.slice(x.start, x.end), retentionOf(x));
      next += encode(c, value.slice(at, x.start) + (h.prefix ?? '')) + marker(h) + encode(c, h.suffix ?? '');
      at = x.end;
    }
    edits.push({ start: c.start, end: c.end, replacement: next + encode(c, value.slice(at)) });
  }

  if (!host && !edits.length) return { action: 'keep', uri, hits: [], warnings, unrestorable: false };
  if (host) warnings.push('host');
  if (markerStyle !== 'code') warnings.push('marker');
  if (host || markerStyle !== 'code' || hyperlinkMode === 'strip_link') return { action: 'strip', hits: [], warnings, unrestorable: true };
  return { action: 'rewrite', uri: applyEdits(uri, edits), hits, warnings, unrestorable: false };
}

/**
 * What scanUri sees in `uri`, for the 測試網址 box (spec §6.1 新增 4): the personal-page hits, else each component
 * with its raw and decoded value (null: undecodable) and the hits in it. Same rules and same code path as scanUri.
 * @returns {{ page: { category: string, text: string }[], parts: { kind: string, raw: string, value: string|null, hits: { category: string, text: string }[] }[] }}
 */
export function explainUri(uri, patterns) {
  const active = patterns.filter((p) => p.enabled !== false && p.applyToUrl !== false);
  const page = resolveOverlaps(active.filter((p) => p.category === URL_CATEGORY).flatMap((p) => scanPattern(uri, p)))
    .map((x) => ({ category: x.category, text: uri.slice(x.start, x.end) }));
  if (page.length) return { page, parts: [] };
  const others = active.filter((p) => p.category !== URL_CATEGORY);
  return {
    page,
    parts: components(uri).map((c) => {
      const { value, cands } = scanComponent(uri, c, others);
      // raw shows a query value with its key (sid=112001); value and hits are the value's own
      const raw = uri.slice(c.ctxStart, c.end).replace(/^[?&]/, '');
      return { kind: c.kind, raw, value, hits: (cands ?? []).map((x) => ({ category: x.category, text: value.slice(x.start, x.end) })) };
    }),
  };
}

/** spec §5.3: `%5B類別%3Acode%5D` in a URI, category percent-encoded. */
export const URI_MARKER_REGEX = /%5B((?:(?!%5B|%5D|%3A).){1,90}?)%3A([0-9a-f]{6})%5D/gi;

/** Puts the hidden parts back into a rewritten URI; other bytes stay. 網址 rows go back raw, others encoded. */
export function restoreUri(uri, mapping) {
  const table = new Map(mapping.map((m) => [m.code, m]));
  const missing = new Set();
  let restoredCount = 0;
  const out = uri.replace(new RegExp(URI_MARKER_REGEX.source, 'gi'), (all, _category, code) => {
    const m = table.get(code.toLowerCase());
    if (!m) {
      missing.add(code.toLowerCase());
      return all;
    }
    restoredCount++;
    return m.category === URL_CATEGORY ? m.original : encodeURIComponent(m.original);
  });
  return { uri: out, missingCodes: [...missing], restoredCount };
}

/** Percent-encoded components of the bare URLs in `text`, in text offsets, with their decoded value (null: broken). */
function encodedParts(text) {
  const out = [];
  for (const m of text.matchAll(new RegExp(URL_REGEX, 'gu'))) {
    const url = trimUrl(m[0]);
    for (const c of components(url)) {
      if (!url.slice(c.start, c.end).includes('%')) continue; // plain text: the normal text scan sees it
      out.push({ url, c, at: m.index });
    }
  }
  return out;
}

/**
 * spec §5.3 text-layer exception: where pattern `p` hits a percent-encoded part of a bare URL in `text`, the
 * candidate is that whole raw part, always hidden whole (`fixed`), so offsets and bytes restore exactly.
 */
export function encodedTextCandidates(text, p) {
  if (p.category === URL_CATEGORY || p.applyToUrl === false || !text.includes('%')) return [];
  return encodedParts(text)
    .filter(({ url, c }) => scanComponent(url, c, [p]).cands?.length)
    .map(({ c, at }) => ({ category: p.category, start: at + c.start, end: at + c.end, fixed: true }));
}

/** Parts of bare URLs in `text` that cannot be decoded: hidden whole as 網址 (fail closed, spec §5.1). */
export function brokenTextCandidates(text) {
  if (!text.includes('%')) return [];
  return encodedParts(text)
    .filter(({ url, c }) => decode(url.slice(c.start, c.end), isQuery(c)) === null)
    .map(({ c, at }) => ({ category: URL_CATEGORY, start: at + c.start, end: at + c.end, fixed: true }));
}
