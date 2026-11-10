// Runs one RegExp off the main thread so a runaway pattern can be terminated (spec §3.3). The admin rule form
// uses it now; Phase 3a grows it into the whole detection.
self.onmessage = ({ data: { regex, text } }) => {
  const t0 = performance.now();
  const re = new RegExp(regex, 'gu');
  const hits = [];
  for (let m; (m = re.exec(text)) !== null; ) {
    if (m[0].length === 0) re.lastIndex++;
    else hits.push([m.index, m.index + m[0].length]);
  }
  self.postMessage({ hits, ms: performance.now() - t0 });
};
