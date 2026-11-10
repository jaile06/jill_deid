// H15 (spec §9.2): a Word-made DOCX with a text box and a tracked deletion (tools/make-h15.ps1).
// Phase 1b only records what upstream leaves behind; Phase 3b-3 fixes it and flips the expectation to [].
import { describe, expect, it } from './runner.js';
import { generateDocx, parseDocx } from '../../assets/js/upstream/formats/docx.js';
import { detect } from '../../assets/js/upstream/core/detector.js';
import { BUILTIN_PATTERNS } from '../../assets/js/upstream/core/patterns.js';
import { applyRedactions } from '../../assets/js/upstream/core/redactor.js';
import { leaks } from './leak-check.js';

describe('H15 docx text box and tracked deletion', () => {
  it('upstream residue (until Phase 3b-3)', async () => {
    const blob = await (await fetch('fixtures/h15.docx')).blob();
    const doc = await parseDocx(new File([blob], 'h15.docx'));
    const items = detect(doc.text, BUILTIN_PATTERNS);
    // 方塊 (文字方塊) is an upstream false positive: 方 is in the surname list.
    expect(items.map((i) => i.original)).toEqual(['方塊', '王小明', 'A123456789', '林志明']);
    const { edits } = applyRedactions(doc.text, items);
    const zip = await globalThis.JSZip.loadAsync(await (await generateDocx(doc, edits)).arrayBuffer());
    const found = await leaks(zip, ['林志明', '王小明', 'A123456789', '陳美玲', 'B200000004', '測試作者']);
    // Text box: the mc:Fallback copy. Tracked deletion: w:delText and its w:author. Author: docProps, people.xml.
    expect(found).toEqual([
      'docProps/core.xml: 測試作者',
      'word/document.xml: A123456789',
      'word/document.xml: B200000004',
      'word/document.xml: 測試作者',
      'word/document.xml: 王小明',
      'word/document.xml: 陳美玲',
      'word/people.xml: 測試作者',
    ]);
  });
});
