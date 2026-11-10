import '../../../vendor/jszip.min.js';
const JSZip = globalThis.JSZip;
                                                                                 
import { applyRedactions, isPartial,                  } from '../core/redactor.js';
import { serializeMapping } from '../core/csv.js';
import { generateDocument, mappingFileName, outputFileName } from './index.js';

                             
                      
                         
 

                                   
                 
                 
                                                                                      
                  
                
                                                                     
                    
 

/** Name of the batch-wide table written when codes are shared or an earlier table was imported. */
export const MERGED_MAPPING_NAME = '合併編碼表.mapping.csv';

/** Keeps zip entry names unique by appending " (2)", " (3)"… before the extension. */
export function uniqueNamer()                           {
  const taken = new Set        ();
  return (name) => {
    let n = name;
    let i = 2;
    while (taken.has(n)) {
      const dot = name.lastIndexOf('.');
      n = dot > 0 ? `${name.slice(0, dot)} (${i})${name.slice(dot)}` : `${name} (${i})`;
      i++;
    }
    taken.add(n);
    return n;
  };
}

export function manifestCsv(rows                    , withMapping = true)         {
  const q = (s        ) => (/[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const partial = rows.some((r) => r.partial);
  const header = '檔案,去識別化檔' + (withMapping ? ',編碼表' : '') + ',生效筆數' + (partial ? ',部分保留' : '');
  const line = (r                  ) => [r.source, r.output, ...(withMapping ? [r.mapping] : []), String(r.count), ...(partial ? [r.partial ? '是' : '否'] : [])].map(q).join(',');
  return '﻿' + [header, ...rows.map(line)].join('\r\n') + '\r\n';
}

/**
 * One archive holding every de-identified document next to its mapping table, plus 清單.csv
 * that pairs them (needed when two inputs share a base name, e.g. 報價單.pdf and 報價單.docx).
 * A marker style that needs no restoring writes the documents only.
 */
export async function buildArchive(entries              , merged                 , style              = 'code')                                                        {
  const zip = new JSZip();
  const unique = uniqueNamer();
  const manifest                     = [];
  const restorable = style === 'code';
  for (const { doc, items } of entries) {
    const { edits, mapping } = applyRedactions(doc.text, items, style);
    const output = unique(outputFileName(doc.fileName, 'deid'));
    const mappingName = restorable ? unique(mappingFileName(doc.fileName)) : '';
    zip.file(output, await generateDocument(doc, edits));
    if (restorable) zip.file(mappingName, serializeMapping(mapping));
    const row                   = { source: doc.fileName, output, mapping: mappingName, count: edits.length };
    if (items.some((it) => it.active && isPartial(it))) row.partial = true;
    manifest.push(row);
  }
  if (merged && restorable) zip.file(unique(MERGED_MAPPING_NAME), serializeMapping(merged));
  zip.file('清單.csv', manifestCsv(manifest, restorable));
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  return { blob, manifest };
}
