// RegExp work off the main thread, so a runaway pattern can be terminated (spec §3.3).
//   { regex, text }            one pattern (admin rule form): replies { hits, ms }
//   { type: 'detect', text, rules } every rule in turn (jill/detect.js): replies { start: id } before each rule,
//                              { done: id, cands } after it. Built-in rules travel as { id, retention } and are
//                              rebuilt here with their check-digit validators, which postMessage cannot carry.
//                              Each rule also covers the percent-encoded parts of bare URLs (spec §5.3).
self.onmessage = async ({ data }) => {
  if (data.type === 'detect') {
    const [{ BUILTIN_PATTERNS }, { scanPattern }, { encodedTextCandidates }] = await Promise.all([
      import('../upstream/core/patterns.js'),
      import('../upstream/core/detector.js'),
      import('./uri-scan.js'),
    ]);
    const builtin = new Map(BUILTIN_PATTERNS.map((p) => [p.id, p]));
    for (const r of data.rules) {
      self.postMessage({ start: r.id });
      const p = builtin.has(r.id) ? { ...builtin.get(r.id), retention: r.retention } : r;
      self.postMessage({ done: r.id, cands: [...scanPattern(data.text, p), ...encodedTextCandidates(data.text, p)] });
    }
    return;
  }
  const t0 = performance.now();
  const re = new RegExp(data.regex, 'gu');
  const hits = [];
  for (let m; (m = re.exec(data.text)) !== null; ) {
    if (m[0].length === 0) re.lastIndex++;
    else hits.push([m.index, m.index + m[0].length]);
  }
  self.postMessage({ hits, ms: performance.now() - t0 });
};
