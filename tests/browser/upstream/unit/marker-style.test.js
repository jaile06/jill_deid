// Ported by tools/port-upstream-tests.mjs from upstream tests/unit/marker-style.test.ts; do not edit (spec §9.2).
import { fileScope } from '../vitest-shim.js';
fileScope('unit/marker-style.test');
import { describe, expect, it } from '../vitest-shim.js';
import { CodeBook, parseMarkers } from '../../../../assets/js/upstream/core/codes.js';
import { detect, resplitItems } from '../../../../assets/js/upstream/core/detector.js';
import { applyRedactions, blankOut, outputFor, previewLabel } from '../../../../assets/js/upstream/core/redactor.js';
import { restore } from '../../../../assets/js/upstream/core/restorer.js';
import { BUILTIN_PATTERNS } from '../../../../assets/js/upstream/core/patterns.js';

const text = '王小明 0912-345-678，amy.chen@gmail.com，住 台北市信義區市府路45號8樓';

/** The sample detected and split under 部分保留 (preview) or 全部隱藏 (undefined). */
function itemsFor(partial         ) {
  const book = new CodeBook();
  const items = detect(text, BUILTIN_PATTERNS, book);
  resplitItems(items, book, () => (partial ? { mode: 'preview' } : undefined));
  return items;
}
const byOriginal = (items                             , o        ) => items.find((i) => i.original === o) ;

describe('blankOut', () => {
  it('turns each letter and digit into ○ and keeps separators', () => {
    expect(blankOut('王小明')).toBe('○○○');
    expect(blankOut('0912-345-678')).toBe('○○○○-○○○-○○○');
    expect(blankOut('amy.chen@gmail.com')).toBe('○○○.○○○○@○○○○○.○○○');
    expect(blankOut('(02) 2712-3456')).toBe('(○○) ○○○○-○○○○');
  });
});

describe('marker styles', () => {
  it('writes the hidden part as a code, the category or ○ under 部分保留', () => {
    const items = itemsFor(true);
    const wang = byOriginal(items, '王小明');
    const phone = byOriginal(items, '0912-345-678');
    const mail = byOriginal(items, 'amy.chen@gmail.com');
    expect(outputFor(wang)).toMatch(/^王\[姓名:[0-9a-f]{6}\]$/);
    expect(outputFor(wang, 'label')).toBe('王[姓名]');
    expect(outputFor(wang, 'blank')).toBe('王○○');
    expect(outputFor(phone, 'blank')).toBe('0912-○○○-○○○');
    expect(outputFor(mail, 'label')).toBe('[電子郵件]@gmail.com');
    expect(outputFor(mail, 'blank')).toBe('○○○.○○○○@gmail.com');
  });

  it('hides whole values under 全部隱藏, ○ for every letter and digit', () => {
    const items = itemsFor(false);
    expect(outputFor(byOriginal(items, '0912-345-678'), 'blank')).toBe('○○○○-○○○-○○○');
    expect(outputFor(byOriginal(items, '台北市信義區市府路45號8樓'), 'blank')).toBe('○'.repeat(14));
    expect(outputFor(byOriginal(items, '王小明'), 'label')).toBe('[姓名]');
  });

  it('previews exactly the output, except that a code shows as its category', () => {
    const wang = byOriginal(itemsFor(true), '王小明');
    expect(previewLabel(wang)).toBe('王[姓名]');
    expect(previewLabel(wang, 'label')).toBe('王[姓名]');
    expect(previewLabel(wang, 'blank')).toBe('王○○');
  });

  it('writes no code and no mapping table when restoring is not needed', () => {
    for (const style of ['label', 'blank']         ) {
      const { redactedText, mapping, edits } = applyRedactions(text, itemsFor(true), style);
      expect(parseMarkers(redactedText)).toEqual([]);
      expect(mapping).toEqual([]);
      expect(edits.length).toBe(4);
      expect(redactedText).not.toContain('小明');
      expect(redactedText).not.toContain('345');
    }
    expect(applyRedactions(text, itemsFor(true), 'blank').redactedText).toBe('王○○ 0912-○○○-○○○，○○○.○○○○@gmail.com，住 台北市信義區○○○○○○○○');
  });

  it('keeps the code style restorable, as before', () => {
    const { redactedText, mapping } = applyRedactions(text, itemsFor(true));
    expect(restore(redactedText, mapping).restoredText).toBe(text);
  });
});
