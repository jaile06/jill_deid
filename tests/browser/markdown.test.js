// Phase 3b-2: link targets in Markdown and pasted text (spec §5.5, H9).
import { describe, expect, it } from './runner.js';
import { BUILTIN_PATTERNS } from '../../assets/js/upstream/core/patterns.js';
import { CodeBook } from '../../assets/js/upstream/core/codes.js';
import { addManualItem, resplitItems } from '../../assets/js/upstream/core/detector.js';
import { restore } from '../../assets/js/upstream/core/restorer.js';
import { detectDocument } from '../../assets/js/jill/detect.js';
import { scanUri } from '../../assets/js/jill/uri-scan.js';
import { markdownLinks, redactWithLinks, textLinks } from '../../assets/js/jill/links/markdown.js';

const C = '[0-9a-f]{6}';
const ID = '%5B%E8%BA%AB%E5%88%86%E8%AD%89%3A'; // encodeURIComponent('[身分證:')
const matches = (s, re) => expect(re.test(s) ? 'match' : s).toBe('match');

/** detect + 部分保留 + output, as the processing page does it */
async function run(text, { format = 'md', hyperlinkMode = 'mask_pii_in_url', style = 'code', manual } = {}) {
  const doc = { fileName: `t.${format}`, format, text };
  const book = new CodeBook();
  const { items } = await detectDocument(doc, BUILTIN_PATTERNS, book);
  if (manual) addManualItem(items, text, ...manual, '識別碼', book);
  const preview = { mode: 'preview' };
  resplitItems(items, book, () => preview);
  return redactWithLinks(text, items, style, textLinks(doc), (uri) => scanUri(uri, BUILTIN_PATTERNS, book, { retentionOf: () => preview, hyperlinkMode, markerStyle: style }));
}

describe('Markdown links (spec §5.5)', () => {
  it('finds inline links, images, definitions and HTML attributes, not autolinks', () => {
    const text = '[a](https://x.tw/1 "t") ![b](<https://x.tw/2>)\n[id]: https://x.tw/3 \'t\'\n<a href="https://x.tw/4">c</a> <https://x.tw/5> https://x.tw/6';
    expect(markdownLinks(text).map((l) => `${l.form}:${l.uri}`)).toEqual(['inline:https://x.tw/1', 'inline:https://x.tw/2', 'definition:https://x.tw/3', 'html:https://x.tw/4']);
  });

  it('H9 text, URL, title and reference each de-identified exactly once', async () => {
    const line = '[王小明](https://example.com/u?id=A123456789 "王小明")';
    const def = '[1]: https://example.com/u?id=A123456789 "王小明"';
    const { redactedText, mapping } = await run(`${line}\n\n見 [王小明][1]\n\n${def}\n`);
    const [l1, , l3, , l5] = redactedText.split('\n');
    matches(l1, new RegExp(`^\\[王\\[姓名:${C}\\]\\]\\(https://example\\.com/u\\?id=A1${ID}${C}%5D "王\\[姓名:${C}\\]"\\)$`));
    matches(l3, new RegExp(`^見 \\[王\\[姓名:${C}\\]\\]\\[1\\]$`));
    matches(l5, new RegExp(`^\\[1\\]: https://example\\.com/u\\?id=A1${ID}${C}%5D "王\\[姓名:${C}\\]"$`));
    for (const leak of ['A123456789', '小明', '23456789']) expect(redactedText).not.toContain(leak);
    // one row per value: the ID in both URLs shares a code, as does the name everywhere
    expect(mapping.map((m) => `${m.category}:${m.prefix ?? ''}|${m.original}`).sort()).toEqual(['姓名:王|小明', '身分證:A1|23456789']);
    // the text layer restores with the upstream restorer; URL markers wait for restoreUri (Phase 3b-5)
    expect(restore(redactedText, mapping).restoredText).toContain('[王小明](https://example.com/u?id=A1%5B');
  });

  it('images, HTML attributes, code blocks and pasted text', async () => {
    const text = '![王小明](https://x.tw/p?id=A123456789)\n<a href="mailto:wang.xm@school.edu.tw">信箱</a>\n```\n身分證 A123456789\n```';
    const { redactedText } = await run(text, { format: 'txt' });
    expect(redactedText).not.toContain('A123456789');
    expect(redactedText).not.toContain('wang.xm');
    expect(redactedText).toContain('@school.edu.tw">信箱</a>');
    matches(redactedText, new RegExp(`\`\`\`\\n身分證 A1\\[身分證:${C}\\]\\n\`\`\`$`));
  });

  it('autolinks and bare URLs stay in the text layer (spec §5.3)', async () => {
    const { redactedText } = await run('<http://10.0.0.1:8080/s> 與 https://x.tw/?id=A123456789');
    matches(redactedText, new RegExp(`^<http://10\\.0\\.\\[IP:${C}\\]/s> 與 https://x\\.tw/\\?id=A1\\[身分證:${C}\\]$`));
  });

  it('strip_link keeps only the text of an inline link and drops a definition', async () => {
    const text = '[王小明](https://x.tw/?id=A123456789 "王小明") 與 [學校](https://school.edu.tw/)\n[1]: mailto:wang.xm@school.edu.tw\n';
    const { redactedText, links } = await run(text, { hyperlinkMode: 'strip_link' });
    matches(redactedText, new RegExp(`^王\\[姓名:${C}\\] 與 \\[學校\\]\\(https://school\\.edu\\.tw/\\)\\n\\n$`));
    expect(links.map((l) => l.decision.action)).toEqual(['strip', 'keep', 'strip']);
  });

  it('a label marker removes links with personal data (spec §5.4)', async () => {
    const { redactedText } = await run('[信箱](mailto:wang.xm@school.edu.tw)', { style: 'label' });
    expect(redactedText).toBe('信箱');
  });

  it('a manual item inside a URL removes that link instead of colliding with its rewrite', async () => {
    const text = '[成績](https://school.edu.tw/g?code=XYZ998)';
    const at = text.indexOf('XYZ998');
    const { redactedText, links } = await run(text, { manual: [at, at + 6] });
    expect(redactedText).toBe('成績');
    expect(links[0].decision.warnings).toEqual(['manual']);
  });
});
