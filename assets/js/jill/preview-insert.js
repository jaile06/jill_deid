// Puts a node into the rendered preview right after text offset `offset` (spec §6.1 新增 3: the 🔗 after a link's
// text). The upstream preview marks every piece of text with data-start (plain spans also data-plain, marks
// data-end); a plain span the offset falls inside is split in two, both keeping correct data-start values, so
// selecting text to add an item still maps to the right offsets. A mark split over paragraphs repeats its range on
// every piece: the last piece wins. Returns false when the offset is not shown (an Excel sheet in another tab, a
// part the preview leaves out).
export function insertAfterOffset(preview, offset, node) {
  let hit = null;
  for (const el of preview.querySelectorAll('[data-start]')) {
    const start = Number(el.dataset.start);
    const end = el.dataset.plain ? start + el.textContent.length : Number(el.dataset.end);
    if (start < offset && offset <= end) hit = el;
  }
  if (!hit) return false;
  const start = Number(hit.dataset.start);
  if (hit.dataset.plain && offset < start + hit.textContent.length) {
    const rest = hit.cloneNode(false);
    rest.dataset.start = String(offset);
    rest.textContent = hit.textContent.slice(offset - start);
    hit.textContent = hit.textContent.slice(0, offset - start);
    hit.after(rest);
  }
  hit.after(node);
  return true;
}
