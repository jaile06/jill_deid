// Column-header detection (spec §6.5). In an Excel sheet or a Word table, the cells under a header whose text is a
// configured label (學號, 姓名…) become candidates of that label's category: numbers stored without a label beside
// them, and names whose surname the built-in rule does not know. Pure function over doc.layout.

const norm = (s) => s.replace(/[\s:：*＊]/g, '').toLowerCase();

/** Table cells as { table, row, col, start, end }; a Word cell's paragraphs are one cell. */
function cellsOf(doc) {
  const layout = doc.layout;
  if (layout?.kind === 'xlsx') {
    return layout.sheets.flatMap((s, i) => s.cells.map((c) => ({ table: `s${i}`, row: c.row, col: c.col, start: c.start, end: c.end })));
  }
  if (layout?.kind === 'docx') {
    const cells = new Map();
    for (const p of layout.paragraphs) {
      if (!p.table) continue;
      const key = `${p.table.id}:${p.table.row}:${p.table.col}`;
      const cell = cells.get(key);
      if (cell) cell.end = p.end;
      else cells.set(key, { table: `t${p.table.id}`, row: p.table.row, col: p.table.col, start: p.start, end: p.end });
    }
    return [...cells.values()];
  }
  return [];
}

/**
 * @param {{ text: string, layout?: object }} doc
 * @param {Record<string, string>} labels   label → category (Config.columnLabels)
 * @param {(category: string) => object | undefined} retentionOf
 * @returns {{ category: string, start: number, end: number, retention?: object, label: string, column: string }[]}
 *   column: one key per column of one table or sheet, so the page can cancel a whole column
 */
export function columnCandidates(doc, labels, retentionOf = () => undefined) {
  const lookup = new Map(Object.entries(labels ?? {}).map(([label, category]) => [norm(label), category]));
  if (lookup.size === 0) return [];
  const labelOf = (c) => lookup.get(norm(doc.text.slice(c.start, c.end)));
  const columns = new Map();
  for (const c of cellsOf(doc)) {
    const key = `${c.table}:${c.col}`;
    if (!columns.has(key)) columns.set(key, []);
    columns.get(key).push(c);
  }
  const out = [];
  for (const [column, cells] of columns) {
    cells.sort((a, b) => a.row - b.row);
    let category = null;
    let label = '';
    cells.forEach((c, i) => {
      const own = labelOf(c);
      if (own) {
        // A header has a value under it; a label above another label is a form (姓名／地址／電話 stacked), not a header.
        const below = cells[i + 1];
        category = below && !labelOf(below) ? own : null;
        label = doc.text.slice(c.start, c.end).trim();
        return;
      }
      if (!category) return;
      let start = c.start;
      let end = c.end;
      while (start < end && /\s/.test(doc.text[start])) start++;
      while (end > start && /\s/.test(doc.text[end - 1])) end--;
      if (end > start) out.push({ category, start, end, retention: retentionOf(category), label, column });
    });
  }
  return out;
}
