                                                                         
import { applyEdits } from '../core/redactor.js';

export async function parsePlainText(file      , format              )                          {
  const text = await file.text();
  return { fileName: file.name, format, text, handle: null };
}

export function generatePlainText(doc                , edits            )       {
  const text = applyEdits(doc.text, edits);
  const mime                            = {
    txt: 'text/plain;charset=utf-8',
    md: 'text/markdown;charset=utf-8',
    docx: '',
    xlsx: '',
    pdf: '',
  };
  return new Blob([text], { type: mime[doc.format] });
}
