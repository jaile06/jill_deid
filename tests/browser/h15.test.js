// H15 (spec §9.2): a Word-made DOCX with a text box and a tracked deletion (tools/make-h15.ps1).
// Phase 1b recorded what upstream left behind; since Phase 3b-3 nothing may remain (spec §5.5 DOCX 6–8).
import { describe, expect, it } from './runner.js';
import { generateDocx, parseDocx } from '../../assets/js/upstream/formats/docx.js';
import { detect } from '../../assets/js/upstream/core/detector.js';
import { BUILTIN_PATTERNS } from '../../assets/js/upstream/core/patterns.js';
import { applyRedactions } from '../../assets/js/upstream/core/redactor.js';
import { leaks } from './leak-check.js';

describe('H15 docx text box and tracked deletion', () => {
  it('no residue: text box fallback, tracked deletion, authors', async () => {
    const blob = await (await fetch('fixtures/h15.docx')).blob();
    const doc = await parseDocx(new File([blob], 'h15.docx'));
    const items = detect(doc.text, BUILTIN_PATTERNS);
    // 方塊 (文字方塊) is an upstream false positive: 方 is in the surname list.
    expect(items.map((i) => i.original)).toEqual(['方塊', '王小明', 'A123456789', '林志明']);
    const { edits } = applyRedactions(doc.text, items);
    const zip = await globalThis.JSZip.loadAsync(await (await generateDocx(doc, edits)).arrayBuffer());
    const found = await leaks(zip, ['林志明', '王小明', 'A123456789', '陳美玲', 'B200000004', '測試作者']);
    // Phase 1b recorded upstream residue here (mc:Fallback, w:delText and w:author, docProps, people.xml); 3b-3 removes it.
    expect(found).toEqual([]);
  });
});
