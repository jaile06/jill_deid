                                                                           
import { CodeBook } from './codes.js';
import { splitFor } from './retention.js';

let nextId = 1;
function newId()         {
  return `r${nextId++}`;
}

                     
                     
                
              
                        
 

function makeItem(text        , start        , end        , category          , book          , origin                   , retention            )                {
  const original = text.slice(start, end);
  const item                = { id: newId(), category, original, start, end, code: '', origin, active: true };
  if (retention) item.retention = retention;
  applySplit(item, retention, book);
  return item;
}

function applySplit(item               , retention                       , book          )       {
  const { head, tail } = splitFor(item.original, retention, item.category);
  if (head) item.head = head;
  else delete item.head;
  if (tail) item.tail = tail;
  else delete item.tail;
  item.code = book.codeFor(item.category, item.original, head, tail);
}

/**
 * Re-splits every item for a new output mode (全部隱藏／部分保留／自訂). Codes follow the split, so an
 * item whose kept characters change gets the code for its new split (see CodeBook).
 */
export function resplitItems(items                 , book          , resolve                                              )       {
  for (const it of items) applySplit(it, resolve(it), book);
}

export function compilePattern(p         )                {
  try {
    return new RegExp(p.regex, 'gu');
  } catch {
    return null;
  }
}

/** Longest match wins; on equal length, the earlier start wins. */
function resolveOverlaps(cands             )              {
  const sorted = [...cands].sort((a, b) => b.end - b.start - (a.end - a.start) || a.start - b.start);
  const chosen              = [];
  for (const c of sorted) {
    if (chosen.every((k) => c.end <= k.start || c.start >= k.end)) chosen.push(c);
  }
  return chosen.sort((a, b) => a.start - b.start);
}

export function detect(text        , patterns           , book           = new CodeBook())                  {
  const cands              = [];
  for (const p of patterns) {
    if (!p.enabled) continue;
    const re = compilePattern(p);
    if (!re) continue;
    let m                        ;
    while ((m = re.exec(text)) !== null) {
      if (m[0].length === 0) {
        re.lastIndex++;
        continue;
      }
      const verdict = p.validate ? p.validate(m[0], text.slice(Math.max(0, m.index - 3), m.index)) : true;
      if (verdict === false || verdict === 0) {
        // Skip only the rejected word, not the whole match: 工程師程大偉 rejects「程師程」but holds「程大偉」.
        re.lastIndex = m.index + Math.min(2, m[0].length);
        continue;
      }
      // A shorter accepted length keeps only that much; matching resumes right after it.
      const length = verdict === true ? m[0].length : Math.min(verdict, m[0].length);
      if (length < m[0].length) re.lastIndex = m.index + length;
      cands.push({ category: p.category, start: m.index, end: m.index + length, retention: p.retention });
    }
  }
  return resolveOverlaps(cands).map((c) => makeItem(text, c.start, c.end, c.category, book, 'auto', c.retention));
}

export class OverlapError extends Error {
  constructor() {
    super('選取範圍與既有項目重疊，請調整選取範圍');
  }
}

export function addManualItem(
  items                 ,
  text        ,
  start        ,
  end        ,
  category          ,
  book          ,
  retention            ,
)                {
  if (start < 0 || end > text.length || start >= end) throw new Error('選取範圍無效');
  const overlaps = items.some((it) => it.active && start < it.end && end > it.start);
  if (overlaps) throw new OverlapError();
  const item = makeItem(text, start, end, category, book, 'manual', retention);
  const next = [...items, item].sort((a, b) => a.start - b.start);
  items.length = 0;
  items.push(...next);
  return item;
}

export function toggleItem(items                 , id        )                            {
  const it = items.find((x) => x.id === id);
  if (!it) return undefined;
  if (!it.active) {
    const overlaps = items.some((o) => o.active && o.id !== id && it.start < o.end && it.end > o.start);
    if (overlaps) throw new OverlapError();
  }
  it.active = !it.active;
  return it;
}
