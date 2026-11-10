// Finds original values left in an output zip (spec §9.2): every entry read as text, *.rels included,
// each value as written, percent-encoded (upper and lower hex), XML-escaped and as HTML entities.
const xmlEscape = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

export function forms(value) {
  const enc = encodeURIComponent(value);
  return [...new Set([
    value,
    enc,
    enc.replace(/%[0-9A-F]{2}/g, (m) => m.toLowerCase()),
    xmlEscape(value),
    [...value].map((c) => `&#${c.codePointAt(0)};`).join(''),
    [...value].map((c) => `&#x${c.codePointAt(0).toString(16)};`).join(''),
  ])];
}

/** "path: value" for every original value still present anywhere in the zip, sorted. */
export async function leaks(zip, values) {
  const found = [];
  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const text = await entry.async('string');
    for (const v of values) if (forms(v).some((f) => text.includes(f))) found.push(`${path}: ${v}`);
  }
  return found.sort();
}
