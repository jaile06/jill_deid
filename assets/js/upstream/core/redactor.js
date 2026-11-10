                                                                     
import { buildMarker } from './codes.js';

/**
 * How the hidden part of a value is written: a code the mapping table restores ([類別:編碼]), or —
 * when the user needs no restoring — the category alone ([類別]) or ○ for each hidden letter or
 * digit (separators stay, so 0912-345-678 keeps its shape).
 */
                                                     

/** Each letter or digit becomes ○; punctuation, spaces and @ stay. */
export const blankOut = (s        )         => s.replace(/[\p{L}\p{N}]/gu, '○');

                                  
                       
                    
                          
 

/** Kept prefix, hidden part and kept suffix of an item's original value. */
export function splitItem(it               )                                                     {
  const head = it.head ?? 0;
  const tail = it.tail ?? 0;
  const o = it.original;
  return { prefix: o.slice(0, head), hidden: o.slice(head, o.length - tail), suffix: o.slice(o.length - tail) };
}

/** What the item becomes in the output file: kept prefix + marker + kept suffix. */
export function outputFor(it               , style              = 'code')         {
  const { prefix, hidden, suffix } = splitItem(it);
  const marker = style === 'code' ? buildMarker(it.category, it.code) : style === 'label' ? `[${it.category}]` : blankOut(hidden);
  return prefix + marker + suffix;
}

/** On-screen stand-in for the output: the output itself, except that a code shows as [類別]. */
export function previewLabel(it               , style              = 'code')         {
  return outputFor(it, style === 'code' ? 'label' : style);
}

export function isPartial(it               )          {
  return Boolean(it.head || it.tail);
}

export function buildEdits(items                 , style              = 'code')             {
  return items
    .filter((it) => it.active)
    .sort((a, b) => a.start - b.start)
    .map((it) => ({ start: it.start, end: it.end, replacement: outputFor(it, style) }));
}

export function applyEdits(text        , edits            )         {
  const sorted = [...edits].sort((a, b) => a.start - b.start);
  let out = '';
  let cursor = 0;
  for (const e of sorted) {
    if (e.start < cursor) throw new Error('編輯範圍重疊');
    out += text.slice(cursor, e.start) + e.replacement;
    cursor = e.end;
  }
  return out + text.slice(cursor);
}

/** The output text and edits, and — for codes only — the mapping table that restores them. */
export function applyRedactions(text        , items                 , style              = 'code')                  {
  const edits = buildEdits(items, style);
  // One row per code, ordered by first occurrence: repeated values share a code (see CodeBook).
  const mapping                 = [];
  const seen = new Set        ();
  for (const it of style === 'code' ? [...items].filter((it) => it.active).sort((a, b) => a.start - b.start) : []) {
    if (seen.has(it.code)) continue;
    seen.add(it.code);
    const { prefix, hidden, suffix } = splitItem(it);
    const entry               = { code: it.code, category: it.category, original: hidden };
    if (prefix) entry.prefix = prefix;
    if (suffix) entry.suffix = suffix;
    mapping.push(entry);
  }
  return { redactedText: applyEdits(text, edits), edits, mapping };
}

/** One row per code across an imported table and several documents, imported rows first. */
export function mergeMappings(...lists                  )                 {
  const seen = new Set        ();
  const out                 = [];
  for (const list of lists) {
    for (const e of list) {
      if (seen.has(e.code)) continue;
      seen.add(e.code);
      out.push(e);
    }
  }
  return out;
}
