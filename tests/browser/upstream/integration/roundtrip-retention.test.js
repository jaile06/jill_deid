// Ported by tools/port-upstream-tests.mjs from upstream tests/integration/roundtrip-retention.test.ts; do not edit (spec §9.2).
import { fileScope } from '../vitest-shim.js';
fileScope('integration/roundtrip-retention.test');
import { describe, expect, it } from '../vitest-shim.js';
import { detect } from '../../../../assets/js/upstream/core/detector.js';
import { applyRedactions } from '../../../../assets/js/upstream/core/redactor.js';
import { restore } from '../../../../assets/js/upstream/core/restorer.js';
import { BUILTIN_PATTERNS } from '../../../../assets/js/upstream/core/patterns.js';
import { SUGGESTED_RETENTION } from '../helpers/retention-fixtures.js';
import { parseDocx, generateDocx } from '../../../../assets/js/upstream/formats/docx.js';
import { parseXlsx, generateXlsx } from '../../../../assets/js/upstream/formats/xlsx.js';
import { buildDocx, toFile, SAMPLE_DOCX_SPEC } from '../helpers/docx-builder.js';
import { buildXlsx, toXlsxFile, SAMPLE_XLSX_SPEC } from '../helpers/xlsx-builder.js';

const SUGGESTED = BUILTIN_PATTERNS.map((p) => ({ ...p, retention: SUGGESTED_RETENTION[p.id] }));

describe('round trip with partial retention', () => {
  it('docx: kept characters survive, restore gives back the original text', async () => {
    const doc = await parseDocx(toFile(await buildDocx(SAMPLE_DOCX_SPEC), 'sample.docx'));
    const items = detect(doc.text, SUGGESTED);
    expect(items.some((i) => i.head || i.tail)).toBe(true);
    const { edits, mapping } = applyRedactions(doc.text, items);
    const out = await parseDocx(toFile(new Uint8Array(await (await generateDocx(doc, edits)).arrayBuffer()), 'out.docx'));
    expect(out.text).toMatch(/A1\[身分證:[0-9a-f]{6}\]/);
    expect(out.text).not.toContain('A123456789');
    expect(restore(out.text, mapping).restoredText).toBe(doc.text);
  });

  it('xlsx: kept characters survive, restore gives back the original text', async () => {
    const doc = await parseXlsx(toXlsxFile(await buildXlsx(SAMPLE_XLSX_SPEC), 'sample.xlsx'));
    const items = detect(doc.text, SUGGESTED);
    const { edits, mapping } = applyRedactions(doc.text, items);
    const out = await parseXlsx(toXlsxFile(new Uint8Array(await (await generateXlsx(doc, edits)).arrayBuffer()), 'out.xlsx'));
    expect(out.text).toMatch(/台北市信義區\[地址:[0-9a-f]{6}\]/);
    expect(out.text).toMatch(/\[手機:[0-9a-f]{6}\]678/);
    expect(restore(out.text, mapping).restoredText).toBe(doc.text);
  });
});
