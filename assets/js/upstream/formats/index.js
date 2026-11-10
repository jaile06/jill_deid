                                                                         
import { MAX_FILE_BYTES } from '../core/types.js';
import { generatePlainText, parsePlainText } from './plaintext.js';
                                             

export const SUPPORTED_EXTENSIONS                            = {
  txt: 'txt',
  md: 'md',
  markdown: 'md',
  docx: 'docx',
  xlsx: 'xlsx',
  pdf: 'pdf',
};

export const ACCEPT_ATTR = '.txt,.md,.markdown,.docx,.xlsx,.pdf';

export function detectFormat(fileName        )                   {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  return SUPPORTED_EXTENSIONS[ext] ?? null;
}

export function validateFile(file      )            {
  const format = detectFormat(file.name);
  if (!format) throw new Error('不支援的檔案格式，請上傳 PDF、Word (.docx)、Excel (.xlsx)、TXT 或 Markdown');
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`檔案超過 ${MAX_FILE_BYTES / 1024 / 1024} MB 上限`);
  }
  return format;
}

/** `ocr` lets an image-only (scanned) PDF be recognised instead of rejected. */
export async function parseDocument(file      , opts                  = {})                          {
  const format = validateFile(file);
  switch (format) {
    case 'txt':
    case 'md':
      return parsePlainText(file, format);
    case 'docx':
      return (await import('./docx.js')).parseDocx(file);
    case 'xlsx':
      return (await import('./xlsx.js')).parseXlsx(file);
    case 'pdf':
      return (await import('./pdf.js')).parsePdf(file, opts);
  }
}

export async function generateDocument(doc                , edits            )                {
  switch (doc.format) {
    case 'txt':
    case 'md':
      return generatePlainText(doc, edits);
    case 'docx':
      return (await import('./docx.js')).generateDocx(doc, edits);
    case 'xlsx':
      return (await import('./xlsx.js')).generateXlsx(doc, edits);
    case 'pdf':
      return (await import('./pdf.js')).generatePdf(doc, edits);
  }
}

export function outputFileName(original        , suffix        )         {
  const dot = original.lastIndexOf('.');
  if (dot <= 0) return `${original}.${suffix}`;
  return `${original.slice(0, dot)}.${suffix}${original.slice(dot)}`;
}

export function mappingFileName(original        )         {
  const dot = original.lastIndexOf('.');
  const base = dot <= 0 ? original : original.slice(0, dot);
  return `${base}.mapping.csv`;
}

export function formatLimitations(format           , ocr = false)                {
  if (format === 'pdf' && ocr) {
    return '此檔為掃描影像，文字由瀏覽器內的文字辨識（OCR）取得，可能有誤認或遺漏，請逐頁核對預覽並手動補上漏抓的項目。輸出只含辨識出的文字（依原位置重繪）與不含文字的圖片（照片、標誌，可在預覽逐張取消保留），其餘頁面影像一律不保留；未辨識出的文字不會出現在輸出中。還原時只還原文字。';
  }
  if (format === 'pdf') {
    return 'PDF 輸出為文字版面重建：文字依原座標繪回，但圖片、圖形與原字型不會保留。此做法確保輸出檔內不殘留任何原始敏感文字。';
  }
  if (format === 'xlsx') {
    return 'Excel 輸出保留儲存格樣式與工作表結構；僅處理文字型儲存格，以數值儲存的電話／證號、公式結果、工作表名稱與註解不在偵測範圍。';
  }
  if (format === 'docx') {
    return 'Word 輸出保留原有樣式與表格；文字方塊、註解等特殊區域可能未涵蓋，請以預覽為準。';
  }
  return null;
}
