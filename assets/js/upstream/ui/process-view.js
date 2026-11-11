                                                                                                      
import { CATEGORIES, MAX_FILE_BYTES } from '../core/types.js';
import { addManualItem, resplitItems, toggleItem } from '../core/detector.js';
import { detectDocument, detectShort } from '../../jill/detect.js'; // jill_deid patch (PATCHES.md P1-4): detection in a worker
import { redactWithLinks, textLinks } from '../../jill/links/markdown.js'; // jill_deid patch (PATCHES.md P1-6)
import { scanUri } from '../../jill/uri-scan.js';
import { insertAfterOffset } from '../../jill/preview-insert.js'; // jill_deid patch (PATCHES.md P1-10)
import { redactLinks } from '../../jill/links/rels.js'; // jill_deid patch (PATCHES.md P1-7)
import { applyRedactions, blankOut, isPartial, mergeMappings, outputFor, previewLabel,                  } from '../core/redactor.js';
import { CodeBook, parseMarkers } from '../core/codes.js';
import { parseMapping, serializeMapping } from '../core/csv.js';
import { getEffectivePatterns, loadConfig, saveConfig, setCategoryRetention } from '../core/pattern-store.js';
import { MODE_LABELS, checkRetention, describeRetention, modesFor, splitFor,                    } from '../core/retention.js';
import { ACCEPT_ATTR, formatLimitations, generateDocument, mappingFileName, outputFileName, parseDocument } from '../formats/index.js';
import { button, clear, downloadBlob, dropZone, el, rejectOversized, toast, withBusy } from './components.js';
import { renderDocumentPreview,                 } from './preview.js';
import { MERGED_MAPPING_NAME, buildArchive } from '../formats/batch.js';
import { SAMPLES, samplesSection } from './samples.js';
import { ocrOverlay } from './ocr-overlay.js';

export const MAX_FILES = 10;

/** 部分保留 (default) keeps the standard statistics-friendly characters; 全部隱藏 hides every value; 自訂 is set per category. */
                                                
const OUTPUT_MODE_LABELS                             = { preview: '部分保留', code: '全部隱藏', custom: '自訂' };

/** 編碼 restores with the mapping table; 類別 and 空白佔位 are for output that is never restored. */
const MARKER_LABELS                              = { code: '編碼', label: '類別', blank: '空白佔位' };
const MARKER_NOTES                                        = {
  code: ['[姓名:6e679d]', '可還原，附編碼表'],
  label: ['[姓名]', '不需還原'],
  blank: ['○○○', '不需還原，保留原本的字數'],
};

/** Monospace fonts draw ○ as a small o: examples written with ○ use the text font. */
const exampleClass = (cls        , marker              = state.marker)         => (marker === 'blank' ? cls : `mono ${cls}`);

/** What an ID number becomes under an output mode and marker style (codes show as [類別], as in the preview). */
function modeExample(mode            , marker             )         {
  if (mode === 'custom') return '逐類別設定';
  const [kept, hidden] = mode === 'preview' ? ['A1', '23456789'] : ['', 'A123456789'];
  return `A123456789 → ${kept}${marker === 'blank' ? blankOut(hidden) : '[身分證]'}`;
}

/** One uploaded (or pasted) document and everything the user has done to it. */
                    
                      
                         
                 
                                                                                                           
                  
                 
                 
 

                 
                   
                                                                
                 
                                                                               
                     
                                                                                   
                                    
                                                    
                    
                                                                                 
                     
                                                                                            
                          
                        
                                             
                       
                                                                           
                                                                 
                                                                                      
                              
                                                                                        
                         
                                                                                             
                      
                                                                           
                                      
                                                                                  
                     
 

const state        = {
  docs: [],
  active: 0,
  plainView: false,
  disabledCategories: new Set(),
  showList: false,
  panelOpen: false,
  categoriesOpen: false,
  advancedOpen: false,
  sharedCodes: false,
  imported: null,
  sharedBook: null,
  outputMode: 'preview',
  marker: 'code',
  overrides: new Map(),
  patternKey: '',
  presetId: null, // jill_deid: the preset in use, its per-category retention and hyperlink mode (spec §3.4, §5.4)
  presetCustom: new Map(),
  hyperlinkMode: 'mask_pii_in_url',
  keepProps: false, // jill_deid patch (P1-10): document properties are cleared unless the user keeps them (spec §5.5 DOCX 7)
};

// jill_deid patch (PATCHES.md P1-4): presets from the module settings (spec §3.4, §6.1 新增 1). Choosing one sets the
// output mode and marker and only re-splits the items; files are not parsed again.
const STRATEGY_MODE = { partial: 'preview', hide_all: 'code', custom: 'custom' };
let presets = [];

export function setPresets(list) {
  presets = list;
  const preset = list.find((p) => p.isDefault);
  if (preset) applyPreset(preset);
}

function applyPreset(p) {
  state.presetId = p?.id ?? null;
  state.presetCustom = new Map(Object.entries(p?.custom ?? {}));
  state.overrides.clear();
  if (!p) return;
  state.outputMode = STRATEGY_MODE[p.keepStrategy] ?? 'preview';
  state.marker = p.markerStyle;
  state.hyperlinkMode = p.hyperlinkMode;
}

/** Categories of organisation rules: under 部分保留 they keep their rule's retention (spec §3.4). */
const orgCategories = () => new Set(getEffectivePatterns().filter((p) => p.source === 'org').map((p) => p.category));

/** Retention of the first enabled rule of a category (the 自訂 default before any override). */
function ruleRetention(category          )                        {
  const r = getEffectivePatterns().find((p) => p.enabled && p.category === category)?.retention;
  return r && r.mode !== 'none' ? r : undefined;
}

/** The 自訂 default of a category: the preset's, then the rule's (spec §3.4). */
const defaultRetention = (category) => state.presetCustom.get(category) ?? ruleRetention(category);

/** What an item keeps under the current output mode; manual items follow their category like detected ones. */
function effectiveRetention(it               , org = orgCategories())                        {
  if (state.outputMode === 'code') return undefined;
  // spec §3.4: standardSplit shows the first character of a category it does not know, so organisation
  // categories keep their own rule's retention instead.
  if (state.outputMode === 'preview') return org.has(it.category) ? it.retention : { mode: 'preview' };
  return state.overrides.get(it.category) ?? state.presetCustom.get(it.category) ?? it.retention;
}

function applyOutputMode(d          )       {
  const org = orgCategories();
  resplitItems(d.items, d.book, (it) => effectiveRetention(it, org));
}

/**
 * jill_deid patch (PATCHES.md P1-6): applyRedactions plus the link targets in the text (spec §5.1, §5.5), so every
 * output — file, copy, mapping table, archive — rewrites the same links with the current settings.
 */
function redact(d, style = state.marker) {
  const org = orgCategories();
  const patterns = getEffectivePatterns();
  // P1-10: the user's choice for one link (🔗: 取消去識別化／移除連結) wins over the automatic decision
  const decide = (uri, link) => {
    const choice = link && d.linkChoices?.get(link.id);
    if (choice === 'keep') return { action: 'keep', hits: [], warnings: [], unrestorable: false };
    if (choice === 'strip') return { action: 'strip', hits: [], warnings: ['user'], unrestorable: true };
    return scanUri(uri, patterns, d.book, { retentionOf: (c) => effectiveRetention(c, org), hyperlinkMode: state.hyperlinkMode, markerStyle: style });
  };
  const opts = { keepProps: state.keepProps };
  if (!['docx', 'xlsx', 'pdf'].includes(d.doc.format)) return { ...redactWithLinks(d.doc.text, d.items, style, textLinks(d.doc), decide), opts };
  // P1-7–P1-9: DOCX, XLSX and PDF links live outside the text; their texts (tooltips…) go through the normal scan
  const plain = (s) => {
    const items = detectShort(s, patterns, d.book);
    resplitItems(items, d.book, (it) => effectiveRetention(it, org));
    return applyRedactions(s, items, style);
  };
  return { ...redactLinks(d.doc.links ?? [], applyRedactions(d.doc.text, d.items, style), style, decide, plain), opts };
}

// ---------------------------------------------------------------------------------------
// jill_deid patch (PATCHES.md P1-10): links on the page (spec §5.4, §6.1 新增 2, 3)
// ---------------------------------------------------------------------------------------
const HYPERLINK_LABELS = { mask_pii_in_url: '只遮網址中的個資', strip_link: '移除含個資的連結' };
const LINK_WARNINGS = {
  undecodable: '網址有無法解碼的片段（例如舊系統的 Big5 編碼），已整段隱藏',
  host: '主機名稱本身是個資，放不下標記：輸出時移除連結，無法還原',
  marker: '標記樣式不是「編碼」，網址放不下可還原的標記：含個資的連結改為移除',
  manual: '手動新增的項目落在網址內：這個連結改為移除',
  pdf: 'PDF 輸出不保留任何連結；這個連結含個資，輸出時會移除',
  user: '你選擇移除這個連結（只留文字）',
};
const decodeUri = (u) => {
  try {
    return decodeURIComponent(u);
  } catch {
    return u;
  }
};
const docLinks = (d) => (['docx', 'xlsx', 'pdf'].includes(d.doc.format) ? d.doc.links ?? [] : textLinks(d.doc));

/** Links worth showing: with personal data or a warning, or with a choice the user made. */
function linkEntries(d) {
  if (docLinks(d).length === 0) return [];
  return redact(d).links.filter(({ link, decision }) => d.linkChoices?.has(link.id) || decision.action !== 'keep' || decision.warnings.length > 0);
}

function linkText(d, link) {
  if (link.displayRange) return d.doc.text.slice(...link.displayRange).trim() || '（空白）';
  if (link.kind === 'pdf') return `第 ${link.page} 頁的連結`;
  if (link.kind === 'xlsx-formula') return `儲存格 ${link.cell} 的 HYPERLINK 公式`;
  return '（沒有顯示文字：圖片、頁首或文件設定中的連結）';
}

/** Before and after of one link, its warnings, and the choices (spec §6.1 新增 3). */
function linkDetail(d, { link, decision }, done, extra = null) {
  const choice = d.linkChoices?.get(link.id);
  const set = (c) => {
    d.linkChoices ??= new Map();
    if (c) d.linkChoices.set(link.id, c);
    else d.linkChoices.delete(link.id);
    markDirty(d);
    done();
  };
  const outcome = decision.action === 'rewrite' ? decodeUri(decision.uri)
    : decision.action === 'strip' ? '（移除連結，只留文字）'
      : choice === 'keep' ? '（保留原連結：含個資，不會去識別化）' : '（保留原連結）';
  return el('div', { class: 'link-detail' },
    el('div', {}, el('span', { class: 'muted small' }, '顯示文字　'), linkText(d, link)),
    el('div', { class: 'small link-uri' }, el('span', { class: 'muted' }, '原連結　'), el('span', { class: 'mono' }, decodeUri(link.uri))),
    el('div', { class: 'small link-uri' }, el('span', { class: 'muted' }, '輸出　　'), el('span', { class: 'mono' }, outcome)),
    ...decision.warnings.map((w) => el('div', { class: 'small notice notice-inline' }, `⚠ ${LINK_WARNINGS[w] ?? w}`)),
    el('div', { class: 'add-popup-row' },
      link.writable === false ? null : choice !== 'keep' ? button('取消去識別化', () => set('keep'), 'btn btn-small') : null,
      link.writable === false ? null : choice !== 'strip' && decision.action !== 'strip' ? button('移除連結', () => set('strip'), 'btn btn-small') : null,
      link.writable === false ? null : choice ? button('恢復自動處理', () => set(null), 'btn btn-small btn-ghost') : null,
      extra),
  );
}

function showLinkPopup(anchor, d, entry, refresh, root) {
  document.querySelector('.add-popup')?.remove();
  const close = () => {
    popup.remove();
    anchor.focus();
  };
  const popup = el('div', { class: 'add-popup link-popup', role: 'dialog', 'aria-label': '連結的去識別化' },
    linkDetail(d, entry, () => {
      popup.remove();
      refresh();
    }, button('關閉', close, 'btn btn-small btn-ghost')),
  );
  popup.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });
  placePopup(popup, anchor.getBoundingClientRect(), root);
  popup.querySelector('button')?.focus();
}

/** 🔗 after the text of each link with personal data; returns the links it could not place (listed above instead). */
function placeLinkButtons(preview, d, entries, refresh, root) {
  // ponytail: Word and plain text only; Excel switches sheets and PDF redraws pages inside preview.js, which would drop the buttons
  const inline = ['md', 'txt', 'docx'].includes(d.doc.format);
  return entries.filter((entry) => {
    if (!inline || !entry.link.displayRange) return true;
    const b = el('button', { type: 'button', class: 'link-flag', 'aria-label': '這個連結含個資：檢視與處理', title: '這個連結含個資：檢視與處理' }, '🔗');
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      showLinkPopup(b, d, entry, refresh, root);
    });
    return !insertAfterOffset(preview, entry.link.displayRange[1], b);
  });
}

function renderLinkList(d, entries, refresh) {
  if (entries.length === 0) return null;
  return el('details', { class: 'output-section doc-links', open: true },
    el('summary', {}, `文件連結（${entries.length} 個含個資或已調整）`),
    el('ul', { class: 'item-list' }, ...entries.map((entry) => el('li', { class: 'item' }, linkDetail(d, entry, refresh)))),
  );
}

function applyOutputModeToAll()       {
  for (const d of state.docs) {
    applyOutputMode(d);
    markDirty(d);
  }
}

/** Seeded from the imported table when there is one; one book for the whole batch when codes are shared. */
function bookForNewDoc()           {
  if (state.sharedCodes && state.sharedBook) return state.sharedBook;
  const book = new CodeBook();
  if (state.imported) book.seed(state.imported.entries);
  if (state.sharedCodes) state.sharedBook = book;
  return book;
}

/** Code scope changed mid-way: give every document a fresh book and reassign all codes. */
function rebuildBooks()       {
  state.sharedBook = null;
  for (const d of state.docs) d.book = bookForNewDoc();
  applyOutputModeToAll();
}

const restorable = ()          => state.marker === 'code';

/** A batch-wide table is offered whenever codes can repeat across files or continue an earlier table. */
const hasMergedTable = ()          => restorable() && (state.sharedCodes || state.imported !== null);

function mergedMapping()                 {
  return mergeMappings(state.imported?.entries ?? [], ...state.docs.map((d) => redact(d, 'code').mapping));
}
/** The mounted view, so changes made in other tabs can re-render it. */
let viewRoot                     = null;

const current = ()           => state.docs[state.active];

function markDirty(d          )       {
  d.version++;
}

/** Without restoring there is no mapping table to download, only the document. */
const isDownloaded = (d          )          => d.docVer === d.version && (!restorable() || d.csvVer === d.version);

function tooltipFor(it               )         {
  return `${it.category}｜原文：${it.original}｜輸出標記：${outputFor(it, state.marker)}${it.origin === 'manual' ? '｜手動新增' : ''}`;
}

function setCategoryEnabled(category          , enabled         )       {
  if (enabled) state.disabledCategories.delete(category);
  else state.disabledCategories.add(category);
  for (const d of state.docs) {
    for (const it of d.items) {
      if (it.category !== category || it.active === enabled) continue;
      try {
        toggleItem(d.items, it.id);
      } catch {
        // re-enabling an item that now overlaps a manual one: leave it cancelled
      }
    }
    markDirty(d);
  }
}

/** Newly detected items honour the categories switched off in the category table. */
function applyDisabledCategories(d          )       {
  for (const it of d.items) if (state.disabledCategories.has(it.category)) it.active = false;
}

export function hasUnsavedResults()          {
  return state.docs.some((d) => d.items.some((it) => it.active) && !isDownloaded(d));
}

export function createProcessView()              {
  const root = el('section', { class: 'view process-view' });
  viewRoot = root;
  state.patternKey = patternKey();
  render(root);
  return root;
}

function patternKey()         {
  return JSON.stringify(getEffectivePatterns().filter((p) => p.enabled).map((p) => [p.id, p.category, p.regex]));
}

/**
 * Called when the tab becomes visible again: if detection rules changed in the meantime
 * (e.g. a rule added in「偵測規則」), re-detect every loaded document, keeping manual items,
 * codes and the user's cancellations for matches that are still found.
 */
export async function syncPatternChanges()       {
  const key = patternKey();
  if (key === state.patternKey) return;
  state.patternKey = key;
  if (state.docs.length === 0 || !viewRoot) return;
  for (const d of state.docs) await rescan(d, true); // jill_deid: detection is async (worker)
  const total = state.docs.reduce((n, d) => n + d.items.length, 0);
  toast(`偵測規則已變更，已重新偵測（共 ${total} 筆）`, 'success');
  render(viewRoot);
}

// ---------------------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------------------
/** Parsing a PDF/Word file (and loading its parser) can take a while: lock the page and show progress meanwhile. */
async function loadFiles(files        , root             )                {
  const accepted = await rejectOversized(files);
  if (accepted.length > 0) await withBusy('讀取檔案中…', () => importFiles(accepted, root));
}

async function importFiles(files        , root             )                {
  const room = MAX_FILES - state.docs.length;
  if (files.length > room) {
    toast(`一次最多處理 ${MAX_FILES} 個檔案（目前已有 ${state.docs.length} 個，只能再加入 ${room} 個）`, 'error', 7000);
    files = files.slice(0, Math.max(0, room));
    if (files.length === 0) return;
  }
  let loaded = 0;
  let firstNew = -1;
  for (const file of files) {
    try {
      const doc = await parseWithOcr(file);
      const book = bookForNewDoc();
      // jill_deid: worker detection plus column candidates; rules the watchdog skipped are warned about now and
      // confirmed before download (spec §3.3 fail closed)
      const { items, skipped } = await detectDocument(doc, getEffectivePatterns(), book);
      const d           = { doc, items, skipped, book, version: 0, docVer: -1, csvVer: -1 };
      if (skipped.length) toast(`${file.name}：規則「${skipped.join('、')}」執行逾時已略過，結果可能遺漏個資，請人工檢查`, 'error', 9000);
      applyOutputMode(d);
      applyDisabledCategories(d);
      state.docs.push(d);
      if (firstNew < 0) firstNew = state.docs.length - 1;
      loaded++;
      if (parseMarkers(doc.text).length > 0) {
        toast(`${file.name}：原文中已存在形如 [類別:編碼] 的文字，可能與去識別化標記混淆。`, 'error', 8000);
      }
    } catch (e) {
      if ((e         ).name === 'AbortError') toast(`已取消辨識「${file.name}」`, 'info');
      else toast(`${file.name}：${(e         ).message}`, 'error', 7000);
    }
  }
  if (loaded === 0) return;
  state.active = firstNew;
  const total = state.docs.reduce((n, d) => n + d.items.length, 0);
  toast(loaded === 1 ? `偵測到 ${current().items.length} 筆敏感資訊` : `已載入 ${loaded} 個檔案，共偵測到 ${total} 筆敏感資訊`, 'success');
  if (current().items.length === 0) toast('此檔案未偵測到敏感資訊。你仍可在預覽中圈選文字手動新增。', 'info', 6000);
  render(root);
}

/** An image-only PDF is recognised behind its own progress screen, which can cancel it (FR-008, FR-009). */
async function parseWithOcr(file      )                          {
  const abort = new AbortController();
  const overlay = ocrOverlay(file.name, () => abort.abort());
  try {
    return await parseDocument(file, { ocr: { signal: abort.signal, onProgress: (p) => overlay.update(p) } });
  } finally {
    overlay.close();
  }
}

/**
 * Re-runs detection on a document, keeping manual items. With `keep`, an automatic match
 * found again at the same place reuses its previous item (id, code, cancelled state).
 */
async function rescan(d          , keep         )                                   {
  const manual = d.items.filter((it) => it.origin === 'manual');
  const old = new Map(d.items.filter((it) => it.origin === 'auto').map((it) => [`${it.start},${it.end},${it.category}`, it]));
  const detected = await detectDocument(d.doc, getEffectivePatterns(), d.book); // jill_deid: worker detection
  d.skipped = detected.skipped;
  const fresh = detected.items
    .filter((a) => !manual.some((m) => m.active && a.start < m.end && a.end > m.start))
    .map((a) => (keep && old.get(`${a.start},${a.end},${a.category}`)) || a);
  d.items = [...manual, ...fresh].sort((a, b) => a.start - b.start);
  applyOutputMode(d);
  applyDisabledCategories(d);
  markDirty(d);
  return { auto: fresh.length, manual: manual.length };
}

async function redetect(root             )       {
  await withBusy('重新偵測中…', async () => {
    const { auto, manual } = await rescan(current(), false);
    toast(`重新偵測完成：自動 ${auto} 筆、手動 ${manual} 筆`, 'success');
    if (current().skipped.length) toast(`規則「${current().skipped.join('、')}」執行逾時已略過，結果可能遺漏個資，請人工檢查`, 'error', 9000);
  });
  render(root);
}

function removeDoc(index        , root             )       {
  const d = state.docs[index];
  if (d.items.some((it) => it.active) && !isDownloaded(d) && !confirm(`「${d.doc.fileName}」尚未下載去識別化結果${restorable() ? '與編碼表' : ''}，確定要移除嗎？`)) return; // xoops-lint-ignore: local confirm, not a server-side delete (spec §6.1)
  state.docs.splice(index, 1);
  state.active = Math.min(state.active, Math.max(0, state.docs.length - 1));
  render(root);
}

function resetAll(root             )       {
  if (hasUnsavedResults() && !confirm('尚有檔案未下載去識別化結果與編碼表，確定要全部清除嗎？')) return; // xoops-lint-ignore: local confirm, not a server-side delete (spec §6.1)
  state.docs = [];
  state.active = 0;
  state.sharedBook = null;
  render(root);
}

// ---------------------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------------------
function render(root             )       {
  clear(root);
  if (state.docs.length === 0) {
    root.append(
      el('h4', {}, '上傳文件'),
      el('p', { class: 'muted' }, `支援 PDF（含掃描檔，會在瀏覽器內辨識文字）、Word (.docx)、Excel (.xlsx)、TXT、Markdown；可一次選擇多個檔案（最多 ${MAX_FILES} 個、格式可混合），單檔 ${MAX_FILE_BYTES / 1024 / 1024} MB 以內。所有處理皆在瀏覽器內完成，文件不會離開你的電腦。`),
      dropZone({
        accept: ACCEPT_ATTR,
        multiple: true,
        label: '拖曳一或多個檔案到這裡，或點擊選擇檔案',
        hint: `.pdf .docx .xlsx .txt .md ・ 最多 ${MAX_FILES} 個`,
        onFiles: (files) => void loadFiles(files, root),
      }),
      renderPasteBox(root),
      el('details', { class: 'code-options', open: state.sharedCodes || state.imported !== null },
        el('summary', {}, '進階：跨檔案共用編碼'),
        renderCodeScope(root),
      ),
      samplesSection('沒有檔案？用範例體驗', SAMPLES, (file) => loadFiles([file], root)),
    );
    return;
  }
  root.append(renderToolbar(root), renderWorkspace(root));
}

/**
 * Code scope (shared across the batch / continued from an imported table). Can be changed at any
 * time: once documents are loaded every code is reassigned and the files need downloading again.
 */
function renderCodeScope(root             )              {
  const changed = (msg        ) => {
    if (state.docs.length) {
      rebuildBooks();
      toast(`${msg}；所有檔案的編碼已重新配置，請重新下載`, 'info', 5000);
    }
    render(root);
  };
  const shared = el('input', { type: 'checkbox' })                    ;
  shared.checked = state.sharedCodes;
  shared.addEventListener('change', () => {
    state.sharedCodes = shared.checked;
    changed(shared.checked ? '已開啟整批共用編碼' : '已關閉整批共用編碼');
  });
  const input = el('input', { type: 'file', accept: '.csv,text/csv', hidden: true })                    ;
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const { entries, errors } = parseMapping(await file.text());
    if (errors.length) {
      toast(`編碼表格式錯誤，未匯入：${errors.slice(0, 3).join('；')}`, 'error', 8000);
      return;
    }
    const warnings = new CodeBook().seed(entries);
    state.imported = { fileName: file.name, entries };
    for (const w of warnings.slice(0, 3)) toast(w, 'error', 8000);
    changed(`已匯入 ${entries.length} 筆編碼，相同的值會沿用原編碼`);
  });
  return el(
    'div',
    { class: 'code-scope' },
    el('label', { class: 'check-label' }, shared, ' 整批共用編碼：同一批檔案中，相同的值使用同一個編碼（方便跨檔案對照）'),
    el('div', { class: 'code-options-row' },
      button(state.imported ? '改匯入其他編碼表' : '匯入既有編碼表（沿用編碼）', () => input.click(), 'btn btn-small'),
      state.imported
        ? el('span', {}, ` 已匯入「${state.imported.fileName}」共 ${state.imported.entries.length} 筆 `, button('移除', () => {
            state.imported = null;
            changed('已移除匯入的編碼表');
          }, 'btn btn-ghost btn-small'))
        : null,
      input,
    ),
    el('p', { class: 'muted small' }, '匯入上次下載的編碼表（或合併編碼表）後，相同的值會沿用原編碼，新值才產生新編碼，可用於每月資料串接。合併編碼表會累積歷次所有個資，請長期妥善保管；匯入的編碼表只存在這個分頁的記憶體中。'),
  );
}

function renderPasteBox(root             )              {
  const area = el('textarea', { class: 'input paste-area', rows: '6', placeholder: '或直接把文字貼在這裡（例如信件、對話紀錄、報表內容），再按「開始去識別化」' })                       ;
  const go = () => {
    const text = area.value;
    if (!text.trim()) {
      toast('請先貼上文字', 'error');
      return;
    }
    const n = state.docs.filter((d) => d.doc.fileName.startsWith('貼上的文字')).length;
    void loadFiles([new File([text], n === 0 ? '貼上的文字.txt' : `貼上的文字-${n + 1}.txt`, { type: 'text/plain' })], root);
  };
  area.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') go();
  });
  return el(
    'div',
    { class: 'paste-box' },
    el('div', { class: 'paste-divider' }, el('span', {}, '或')),
    area,
    el('div', { class: 'paste-actions' }, button('開始去識別化', go, 'btn btn-primary'), el('span', { class: 'muted small' }, '貼上的文字會以純文字處理，結果可下載為 .txt 或直接複製')),
  );
}

/** A small dropdown of secondary actions; closes after picking one. */
function menu(label        , items                                 )              {
  const box = el('details', { class: 'menu' })                      ;
  const list = el('div', { class: 'menu-list' });
  for (const it of items) {
    if (!it) continue;
    list.append(button(it[0], () => {
      box.open = false;
      it[1]();
    }, 'menu-item'));
  }
  box.append(el('summary', { class: 'btn' }, label), list);
  return box;
}

const withTip = (e             , tip        )              => {
  e.dataset.tip = tip;
  return e;
};

function renderToolbar(root             )              {
  const d = current();
  const doc = d.doc;
  const limits = formatLimitations(doc.format, doc.ocr);
  const many = state.docs.length > 1;
  const partialCats = [...new Set(d.items.filter((it) => it.active && isPartial(it)).map((it) => it.category))];
  const text = doc.format === 'txt' || doc.format === 'md';
  const mode = [
    `${OUTPUT_MODE_LABELS[state.outputMode]}・${MARKER_LABELS[state.marker]}（${restorable() ? '可還原' : '無法還原'}）`,
    restorable() && state.sharedCodes ? '整批共用編碼' : '',
    restorable() && state.imported ? `沿用「${state.imported.fileName}」的編碼` : '',
  ].filter(Boolean);
  const moreItems                                  = [
    many ? [restorable() ? '下載此檔（文件＋編碼表）' : '下載此檔', () => void downloadBoth(d, root)] : null,
    restorable() ? ['只下載去識別化文件', () => void downloadDoc(d, root)] : null,
    restorable() ? ['只下載編碼表 (CSV)', () => downloadCsv(d, root)] : null,
    text ? ['複製去識別化文字', () => void copyText(d)] : null,
    hasMergedTable() ? ['下載合併編碼表', downloadMerged] : null,
  ];
  const more = moreItems.some(Boolean) ? menu('更多 ▾', moreItems) : null;
  return el(
    'div',
    { class: 'toolbar toolbar-stack' },
    el('div', { class: 'toolbar-row' },
      el('div', { class: 'file-info' },
        el('strong', {}, doc.fileName),
        el('span', { class: 'badge' }, doc.format.toUpperCase()),
        doc.ocr ? el('span', { class: 'badge badge-ocr', 'data-tip': '此檔為掃描影像，文字由瀏覽器內的文字辨識（OCR）取得' }, '文字辨識') : null,
        el('span', { class: 'muted' }, ` ${doc.text.length.toLocaleString()} 字`),
        many ? el('span', { class: 'muted' }, `　（第 ${state.active + 1} / ${state.docs.length} 個檔案）`) : null,
      ),
      el('div', { class: 'toolbar-actions' },
        button('重新偵測', () => redetect(root), 'btn'),
        button(many ? '全部清除' : '換一個檔案', () => resetAll(root), 'btn btn-ghost'),
        many
          ? button(`打包下載全部（${state.docs.length} 個檔案）`, () => void downloadAll(root), 'btn btn-primary btn-strong')
          : withTip(button(restorable() ? '下載（文件＋編碼表）' : '下載去識別化文件', () => void downloadBoth(d, root), 'btn btn-primary btn-strong'), restorable() ? '編碼表是還原的唯一憑證，請妥善保管' : '不需還原：只下載去識別化文件'),
        more,
      ),
    ),
    el('div', { class: 'toolbar-row status-line muted small' },
      el('span', { class: 'status-mode' }, mode.join('・')),
      limits ? el('span', { class: 'status-info', 'data-tip': limits, tabindex: '0' }, 'ⓘ 格式限制') : null,
      partialCats.length
        ? el('span', { class: 'status-partial notice notice-inline', 'data-tip': `${partialCats.join('、')}：保留的字元會出現在輸出中，並非完全匿名`, tabindex: '0' }, `⚠ 含部分保留（${partialCats.length} 類）`)
        : null,
    ),
  );
}

function renderFilePanel(root             )              {
  const panel = el('aside', { class: 'file-panel' });
  const list = el('ul', { class: 'file-list' });
  state.docs.forEach((d, i) => {
    const active = d.items.filter((it) => it.active).length;
    list.append(
      el(
        'li',
        { class: `file-item${i === state.active ? ' active' : ''}` },
        el('button', { type: 'button', class: 'file-item-main', onClick: () => { state.active = i; render(root); } },
          el('span', { class: 'file-item-name', title: d.doc.fileName }, d.doc.fileName),
          el('span', { class: 'file-item-meta' },
            el('span', { class: 'badge' }, d.doc.format.toUpperCase()),
            el('span', { class: 'muted small' }, ` ${active} / ${d.items.length} 筆`),
            isDownloaded(d) ? el('span', { class: 'tag tag-done' }, '已下載') : null,
          ),
        ),
        el('button', { type: 'button', class: 'file-item-remove', title: '移除此檔案', onClick: () => removeDoc(i, root) }, '×'),
      ),
    );
  });
  const input = el('input', { type: 'file', accept: ACCEPT_ATTR, multiple: true, hidden: true })                    ;
  input.addEventListener('change', () => {
    if (input.files?.length) void loadFiles(Array.from(input.files), root);
    input.value = '';
  });
  panel.append(
    el('div', { class: 'file-panel-head' }, el('h4', {}, `檔案（${state.docs.length}/${MAX_FILES}）`)),
    list,
    state.docs.length < MAX_FILES ? button('＋ 加入檔案', () => input.click(), 'btn btn-small') : el('p', { class: 'muted small' }, `已達 ${MAX_FILES} 個上限`),
    input,
  );
  return panel;
}

function renderWorkspace(root             )              {
  const d = current();
  const preview = el('div', { class: 'preview', tabindex: '0' });
  const sidebar = el('aside', { class: 'sidebar' });
  const outputHost = el('div', {});
  const linksHost = el('div', {}); // jill_deid patch (P1-10): 文件連結 (spec §6.1 新增 3)
  const headTools = el('div', { class: 'preview-head-tools' });
  const previewWrap = el('div', { class: 'preview-wrap' },
    el('div', { class: 'preview-head' }, el('h4', {}, '去識別化預覽'), headTools),
    el('p', { class: 'muted small preview-desc' }, `預覽即下載後的樣子${restorable() ? '（編碼以 [類別] 顯示）' : ''}：點標記可取消、圈選文字可新增，滑鼠停留可看原文。${previewHint(d.doc)}`),
    outputHost,
    linksHost,
    preview,
  );
  const ws = el('div', { class: 'workspace' });
  const refresh = () => {
    clear(outputHost);
    outputHost.append(renderOutputPanel(root));
    clear(headTools);
    const active = d.items.filter((it) => it.active).length;
    const plain = el('input', { type: 'checkbox' })                    ;
    plain.checked = state.plainView;
    plain.addEventListener('change', () => {
      state.plainView = plain.checked;
      refresh();
    });
    if (d.doc.layout) headTools.append(el('label', { class: 'check-label small' }, plain, ' 純文字檢視'));
    headTools.append(
      button(`${state.showList ? '▾ 收合' : '▸ 展開'}偵測清單（生效 ${active} / 共 ${d.items.length}）`, () => {
        state.showList = !state.showList;
        refresh();
      }, `btn btn-small list-toggle${state.showList ? ' is-open' : ''}`),
    );
    ws.classList.toggle('workspace-with-list', state.showList);
    ws.classList.toggle('workspace-with-files', state.docs.length > 1);
    sidebar.hidden = !state.showList;
    renderPreview(preview, refresh, root);
    // jill_deid patch (P1-10): 🔗 after each link with personal data; the rest are listed above the preview
    clear(linksHost);
    const list = renderLinkList(d, placeLinkButtons(preview, d, linkEntries(d), refresh, root), refresh);
    if (list) linksHost.append(list);
    if (state.showList) renderSidebar(sidebar, preview, refresh);
  };
  if (state.docs.length > 1) ws.append(renderFilePanel(root));
  ws.append(previewWrap, sidebar);
  refresh();
  return ws;
}

/**
 * The single place to decide what the output shows: mode, per-category on/off and retention,
 * 設為預設, and the code scope. Collapsed to a one-line summary by default.
 */
function renderOutputPanel(root             )              {
  const setMode = (mode            ) => {
    state.outputMode = mode;
    applyOutputModeToAll();
    render(root); // preview, toolbar status and partial-retention notice all change
  };
  // The output text changes, codes do not: every document needs downloading again.
  const setMarker = (marker             ) => {
    state.marker = marker;
    for (const d of state.docs) markDirty(d);
    render(root);
  };
  /** One choice as a row of joined buttons (radios underneath, so keyboard use is unchanged). */
  const segmented =                   (name        , labels                   , current   , onChange                ) =>
    el('div', { class: 'segmented', role: 'radiogroup' },
      ...(Object.keys(labels)       ).map((v) => {
        const r = el('input', { type: 'radio', name, value: v })                    ;
        r.checked = current === v;
        r.addEventListener('change', () => onChange(v));
        return el('label', { class: 'segment' }, r, el('span', {}, labels[v]));
      }),
    );
  const [markerExample, markerNote] = MARKER_NOTES[state.marker];
  // jill_deid patch (P1-10): 超連結 and document properties (spec §5.4, §5.5 DOCX 7, §6.1 新增 2)
  const hasLinks = state.docs.some((d) => docLinks(d).some((l) => l.writable !== false));
  const hasProps = state.docs.some((d) => d.doc.format === 'docx' || d.doc.format === 'xlsx');
  const setHyperlinkMode = (mode) => {
    state.hyperlinkMode = mode;
    for (const d of state.docs) markDirty(d);
    render(root);
  };
  const props = el('input', { type: 'checkbox' });
  props.checked = !state.keepProps;
  props.addEventListener('change', () => {
    state.keepProps = !props.checked;
    for (const d of state.docs) markDirty(d);
    render(root);
  });
  const notices = [
    state.outputMode === 'preview' ? '部分保留會露出姓氏、證號前 2 碼、手機前 4 碼等，並非完全匿名' : '',
    restorable() ? '' : `不需還原：只下載文件、沒有編碼表${state.marker === 'blank' ? '；空白佔位會保留原本的字數，需要更高的匿名性請選「類別」' : ''}`,
    hasLinks && !restorable() ? '標記不是「編碼」時，網址放不下可還原的標記，含個資的連結會移除（只留文字）' : '', // H11
    hasProps && state.keepProps ? '保留文件屬性：作者、最後修改者、公司會留在輸出檔' : '',
  ].filter(Boolean);
  const section = (cls        , title        , open         , onToggle                         , ...body                        ) => {
    const d = el('details', { class: `output-section ${cls}`, open }, el('summary', {}, title), ...body.filter((b)                   => b !== null))                      ;
    d.addEventListener('toggle', () => onToggle(d.open));
    return d;
  };
  const present = CATEGORIES.filter((c) => state.docs.some((d) => d.items.some((it) => it.category === c))).length;
  const active = state.docs.reduce((n, d) => n + d.items.filter((it) => it.active).length, 0);
  const box = el('details', { class: 'output-panel', open: state.panelOpen })                      ;
  // The summary must read as a control, not a caption: a mode pill plus an explicit 調整 ▾ button.
  const action = el('span', { class: 'btn btn-small summary-action' }, state.panelOpen ? '收合 ▴' : '調整 ▾');
  box.addEventListener('toggle', () => {
    state.panelOpen = box.open;
    action.textContent = box.open ? '收合 ▴' : '調整 ▾';
  });
  const saveDefault = () => {
    let config = loadConfig();
    for (const [category, r] of state.overrides) config = setCategoryRetention(config, category, r);
    saveConfig(config);
    // The saved default is now each item's own rule retention, so the output stays the same after clearing overrides.
    for (const d of state.docs) {
      for (const it of d.items) {
        const r = state.overrides.get(it.category);
        if (!r) continue;
        if (r.mode === 'none') delete it.retention;
        else it.retention = r;
      }
    }
    state.overrides.clear();
    toast('已設為預設：之後選「自訂」會套用這些保留方式（可在「偵測規則」頁各規則的「查看規則」中看到）', 'success', 5000);
    render(root);
  };
  const children                         = [
    el('summary', { class: 'output-panel-summary', title: '調整保留多少、標記方式、類別與編碼範圍' },
      el('span', { class: 'summary-main' },
        el('strong', {}, '輸出設定'),
        // Shown while collapsed; the rows below say the same once open.
        el('span', { class: 'mode-pill summary-detail' }, OUTPUT_MODE_LABELS[state.outputMode]),
        el('span', { class: `mode-pill summary-detail${restorable() ? '' : ' mode-pill-final'}` }, restorable() ? MARKER_LABELS.code : `${MARKER_LABELS[state.marker]}・無法還原`),
        el('span', { class: `summary-detail ${exampleClass('small muted')}` }, modeExample(state.outputMode, state.marker)),
        el('span', { class: 'muted small' }, `生效 ${active} 筆${hasMergedTable() ? '・共用／沿用編碼' : ''}`),
      ),
      action,
    ),
    el('div', { class: 'output-rows' },
      presets.length ? renderPresetRow(root) : null, // jill_deid patch (P1-4): 情境 (spec §6.1 新增 1)
      el('div', { class: 'output-row', 'data-row': 'keep' },
        el('span', { class: 'output-row-label' }, '保留'),
        segmented('output-mode', OUTPUT_MODE_LABELS, state.outputMode, setMode),
        el('span', { class: `output-row-note ${exampleClass('small muted')}` }, modeExample(state.outputMode, state.marker)),
      ),
      el('div', { class: 'output-row', 'data-row': 'marker' },
        el('span', { class: 'output-row-label' }, '標記'),
        segmented('marker-style', MARKER_LABELS, state.marker, setMarker),
        el('span', { class: 'output-row-note small muted' }, el('span', { class: exampleClass('') }, markerExample), `　${markerNote}`),
      ),
      hasLinks ? el('div', { class: 'output-row', 'data-row': 'links' }, // jill_deid patch (P1-10)
        el('span', { class: 'output-row-label' }, '超連結'),
        segmented('hyperlink-mode', HYPERLINK_LABELS, state.hyperlinkMode, setHyperlinkMode),
        el('span', { class: 'output-row-note small muted' }, state.hyperlinkMode === 'strip_link'
          ? '含個資的連結只留文字，連結本身無法還原'
          : '連結保留，網址中的個資換成標記（標記為「編碼」時可還原）'),
      ) : null,
      hasProps ? el('div', { class: 'output-row', 'data-row': 'props' },
        el('span', { class: 'output-row-label' }, '文件屬性'),
        el('label', { class: 'check-label small' }, props, ' 清除作者、最後修改者、公司（Word、Excel）'),
      ) : null,
    ),
    notices.length ? el('p', { class: 'small notice notice-inline output-notice' }, `⚠ ${notices.join('；')}`) : null,
    section('by-category', `依類別調整（${present} 類）`, state.outputMode === 'custom' || state.categoriesOpen, (open) => (state.categoriesOpen = open),
      renderCategoryTable(root),
      state.outputMode === 'custom'
        ? el('div', { class: 'form-actions' },
            button('設為預設', saveDefault, 'btn btn-small'),
            el('span', { class: 'muted small' }, state.overrides.size ? '把目前各類別的保留方式存為預設，之後選「自訂」會自動套用。' : '目前沿用預設值。'),
          )
        : null,
    ),
    restorable() ? section('code-advanced', '進階：編碼範圍', state.advancedOpen, (open) => (state.advancedOpen = open), renderCodeScope(root)) : null,
  ];
  box.append(...children.filter((c)                   => c !== null));
  return box;
}

/** jill_deid patch (P1-4): the preset row; switching only re-splits the items (spec §6.1 新增 1). */
function renderPresetRow(root             )              {
  const select = el('select', { class: 'select', id: 'jill-deid-preset' },
    el('option', { value: '' }, '不套用情境'),
    ...presets.map((p) => el('option', { value: String(p.id) }, p.isDefault ? `${p.title}（預設）` : p.title)),
  )                     ;
  select.value = state.presetId === null ? '' : String(state.presetId);
  select.addEventListener('change', () => {
    applyPreset(presets.find((p) => String(p.id) === select.value));
    applyOutputModeToAll();
    render(root);
  });
  const note = presets.find((p) => p.id === state.presetId)?.description ?? '';
  return el('div', { class: 'output-row', 'data-row': 'preset' },
    el('label', { class: 'output-row-label', for: 'jill-deid-preset' }, '情境'),
    select,
    el('span', { class: 'output-row-note small muted' }, note),
  );
}

function renderCategoryTable(root             )              {
  const present = CATEGORIES.filter((c) => state.docs.some((d) => d.items.some((it) => it.category === c)));
  if (present.length === 0) return el('p', { class: 'muted small' }, '目前沒有偵測項目。');
  const custom = state.outputMode === 'custom';
  const org = orgCategories();
  const rows = present.map((category) => {
    const items = state.docs.flatMap((d) => d.items).filter((it) => it.category === category);
    const sample = items[0].original;
    const off = state.disabledCategories.has(category);
    const enabled = el('input', { type: 'checkbox', title: '取消勾選即整類不去識別化（套用到所有檔案）' })                    ;
    enabled.checked = !off;
    enabled.addEventListener('change', () => {
      setCategoryEnabled(category, enabled.checked);
      render(root);
    });
    const override = state.overrides.get(category);
    // jill_deid (P1-4, spec §3.4): organisation categories keep their rule's retention under 部分保留; 自訂 defaults to the preset's
    const applied                        = state.outputMode === 'code' ? undefined
      : state.outputMode === 'preview' ? (org.has(category) ? ruleRetention(category) : { mode: 'preview' })
      : override ?? defaultRetention(category);
    const out = el('span', { class: exampleClass('small') });
    const msg = el('span', { class: 'small' });
    const show = (r                       ) => {
      const s = splitFor(sample, r, category);
      const hidden = sample.slice(s.head, sample.length - s.tail);
      out.textContent = `${sample} → ${sample.slice(0, s.head)}${state.marker === 'blank' ? blankOut(hidden) : `[${category}]`}${sample.slice(sample.length - s.tail)}`;
    };
    show(applied);
    let control             ;
    if (!custom || off) {
      control = el('span', { class: 'muted small' }, off ? '不處理' : describeRetention(applied));
    } else {
      const current            = override ?? defaultRetention(category) ?? { mode: 'none' };
      const mode = el('select', { class: 'select' },
        el('option', { value: 'rule' }, `預設（${describeRetention(defaultRetention(category))}）`),
        ...modesFor(category).map((m) => el('option', { value: m }, MODE_LABELS[m])),
      )                     ;
      mode.value = override ? override.mode : 'rule';
      const head = el('input', { class: 'input input-num', type: 'number', min: '0', value: String(current.mode === 'ends' ? current.head : 0) })                    ;
      const tail = el('input', { class: 'input input-num', type: 'number', min: '0', value: String(current.mode === 'ends' ? current.tail : 0) })                    ;
      const delim = el('input', { class: 'input input-num', value: current.mode === 'delim' ? current.delimiter : '@' })                    ;
      const side = el('select', { class: 'select' }, el('option', { value: 'after' }, '之後'), el('option', { value: 'before' }, '之前'))                     ;
      if (current.mode === 'delim') side.value = current.side;
      const endsBox = el('span', { class: 'retention-fields', hidden: mode.value !== 'ends' }, '前 ', head, ' 後 ', tail);
      const delimBox = el('span', { class: 'retention-fields', hidden: mode.value !== 'delim' }, delim, side);
      const read = ()                   => {
        const m = mode.value                          ;
        if (m === 'rule') return null;
        if (m === 'ends') return { mode: 'ends', head: Number(head.value), tail: Number(tail.value) };
        if (m === 'delim') return { mode: 'delim', delimiter: delim.value, side: side.value                       };
        return { mode: m }             ;
      };
      const paint = (r                  )          => {
        const check = r ? checkRetention(sample, r, category) : { error: null, warnings: [] };
        msg.className = `small ${check.error ? 'field-error' : check.warnings.length ? 'notice notice-inline' : ''}`;
        msg.textContent = check.error ?? (check.warnings.length ? `⚠ ${check.warnings.join(' ')}` : '');
        show(r ?? defaultRetention(category));
        return !check.error;
      };
      const apply = () => {
        endsBox.hidden = mode.value !== 'ends';
        delimBox.hidden = mode.value !== 'delim';
        const r = read();
        if (!paint(r)) return; // keep the invalid input on screen with its error, output unchanged
        if (r) state.overrides.set(category, r);
        else state.overrides.delete(category);
        applyOutputModeToAll();
        render(root);
      };
      for (const input of [mode, head, tail, delim, side]) input.addEventListener('change', apply);
      paint(override ?? null);
      control = el('span', { class: 'retention-control' }, mode, endsBox, delimBox);
    }
    return el('tr', { class: off ? 'row-disabled' : '' },
      el('td', { class: 'col-nowrap' }, el('label', { class: 'check-label' }, enabled, el('span', { class: `badge badge-${category}` }, category), el('span', { class: 'muted small' }, ` ${items.length} 筆`))),
      el('td', {}, control),
      el('td', {}, out, ' ', msg),
    );
  });
  return el('div', { class: 'table-wrap' }, el('table', { class: 'table output-table' }, el('tbody', {}, ...rows)));
}

function previewHint(doc                )         {
  if (doc.layout?.kind === 'xlsx') return '上方可切換工作表。';
  if (doc.layout?.kind === 'pdf' && doc.ocr) return '綠框圖片會保留在輸出中（可逐張取消），請對照原檔核對。';
  return '';
}

function renderPreview(preview             , refresh            , root             )       {
  const d = current();
  const decorations               = d.items.map((it) =>
    it.active
      ? { start: it.start, end: it.end, id: it.id, kind: 'mark', label: previewLabel(it, state.marker), className: `mark-${it.category}`, tip: tooltipFor(it) }
      : { start: it.start, end: it.end, id: it.id, kind: 'cancelled', label: '', className: '', tip: `已取消，顯示原文（${it.category}）；點擊可加回` },
  );
  renderDocumentPreview(preview, d.doc, decorations, {
    plain: state.plainView,
    onTogglePicture: (pic) => {
      pic.keep = !pic.keep;
      markDirty(d);
      refresh();
    },
  });
  preview.onmouseup = () => handleSelection(preview, refresh, root);
  preview.onclick = (e) => {
    const target = (e.target                  )?.closest             ('[data-id]');
    if (!target || !preview.contains(target)) return;
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) return; // a drag-selection, not a click
    const item = d.items.find((it) => it.id === target.dataset.id);
    if (item) showItemPopup(target.getBoundingClientRect(), item, refresh, root);
  };
}

function showItemPopup(rect         , item               , done            , root             )       {
  document.querySelector('.add-popup')?.remove();
  const d = current();
  const popup = el(
    'div',
    { class: 'add-popup' },
    el('div', { class: 'add-popup-text' },
      el('span', { class: `badge badge-${item.category}` }, item.category),
      ` ${item.original} → ${previewLabel(item, state.marker)}`,
      el('div', { class: 'muted small' }, `輸出標記 ${outputFor(item, state.marker)}${item.origin === 'manual' ? '（手動新增）' : ''}`),
    ),
    el('div', { class: 'add-popup-row' },
      el('span', {}, item.active ? '要取消這一筆的去識別化嗎？' : '要把這一筆加回去識別化嗎？'),
      button(item.active ? '取消去識別化' : '加回', () => {
        try {
          toggleItem(d.items, item.id);
          markDirty(d);
          popup.remove();
          done();
        } catch (err) {
          toast((err         ).message, 'error');
        }
      }, item.active ? 'btn btn-danger-solid' : 'btn btn-primary'),
      button('關閉', () => popup.remove(), 'btn btn-ghost'),
    ),
  );
  placePopup(popup, rect, root);
}

function placePopup(popup             , rect         , root             )       {
  const top = rect.bottom + window.scrollY + 6;
  const left = Math.max(8, Math.min(rect.left + window.scrollX, window.innerWidth - 380));
  popup.style.top = `${top}px`;
  popup.style.left = `${left}px`;
  (document.getElementById('jill-deid-portal') ?? document.body).append(popup);
}

function offsetOf(container      , offset        )                {
  const elNode = container.nodeType === Node.TEXT_NODE ? container.parentElement : (container           );
  const holder = elNode?.closest('[data-start]')                      ;
  if (!holder) return null;
  const base = Number(holder.dataset.start);
  if (holder.dataset.plain) {
    return container.nodeType === Node.TEXT_NODE ? base + offset : base;
  }
  // Inside a mark/cancelled span: snap to its boundary.
  return offset === 0 ? base : Number(holder.dataset.end);
}

function handleSelection(preview             , refresh            , root             )       {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
  const range = sel.getRangeAt(0);
  if (!preview.contains(range.startContainer) || !preview.contains(range.endContainer)) return;
  const a = offsetOf(range.startContainer, range.startOffset);
  const b = offsetOf(range.endContainer, range.endOffset);
  if (a === null || b === null) return;
  const start = Math.min(a, b);
  const end = Math.max(a, b);
  if (end <= start) return;
  showAddPopup(range.getBoundingClientRect(), start, end, () => {
    sel.removeAllRanges();
    refresh();
  }, root);
}

function showAddPopup(rect         , start        , end        , done            , root             )       {
  document.querySelector('.add-popup')?.remove();
  const d = current();
  const text = d.doc.text.slice(start, end);
  const select = el('select', { class: 'select' }, ...CATEGORIES.map((c) => el('option', { value: c }, c)))                     ;
  const popup = el(
    'div',
    { class: 'add-popup' },
    el('div', { class: 'add-popup-text' }, `「${text.length > 40 ? text.slice(0, 40) + '…' : text}」`),
    el('div', { class: 'add-popup-row' }, select, button('新增為去識別化項目', () => {
      try {
        // FR-009: manual items follow their category's retention, like detected ones.
        const rule = getEffectivePatterns().find((p) => p.enabled && p.category === select.value);
        addManualItem(d.items, d.doc.text, start, end, select.value            , d.book, rule?.retention);
        applyOutputMode(d);
        markDirty(d);
        popup.remove();
        toast('已新增', 'success', 1500);
        done();
      } catch (e) {
        toast((e         ).message, 'error');
      }
    }, 'btn btn-primary'), button('取消', () => popup.remove(), 'btn btn-ghost')),
  );
  placePopup(popup, rect, root);
}

function renderSidebar(sidebar             , preview             , refresh            )       {
  clear(sidebar);
  const d = current();
  const active = d.items.filter((it) => it.active);

  const list = el('ul', { class: 'item-list' });
  const sorted = [...d.items].sort((a, b) => a.start - b.start);
  for (const it of sorted) {
    const li = el(
      'li',
      { class: `item ${it.active ? '' : 'item-cancelled'}` },
      el('div', { class: 'item-main', title: tooltipFor(it), onClick: () => locate(preview, it.id) },
        el('span', { class: `badge badge-${it.category}` }, it.category),
        el('span', { class: 'item-original' }, it.original),
        el('span', { class: 'item-mask muted' }, `→ ${previewLabel(it, state.marker)}`),
        // jill_deid patch (P1-10): where the item came from (spec §6.1 新增 7)
        el('span', { class: 'tag', title: it.column ? '整欄依欄首標籤偵測' : '' }, it.origin === 'manual' ? '手動' : it.column ? `欄首「${it.label}」` : '規則'),
      ),
      el('div', { class: 'item-meta' }, button(it.active ? '取消' : '加回', () => {
        try {
          toggleItem(d.items, it.id);
          markDirty(d);
          refresh();
        } catch (e) {
          toast((e         ).message, 'error');
        }
      }, 'btn btn-small')),
    );
    list.append(li);
  }

  sidebar.append(
    el('h4', {}, `偵測項目（生效 ${active.length} / 共 ${d.items.length}）`),
    renderColumnBatch(d, refresh),
    d.items.length === 0 ? el('p', { class: 'muted' }, '目前沒有項目。可在預覽中圈選文字新增。') : list,
  );
}

/** jill_deid patch (P1-10): a column found by its header is cancelled or added back as a whole (spec §6.1 新增 7). */
function renderColumnBatch(d, refresh) {
  const columns = Map.groupBy(d.items.filter((it) => it.column), (it) => it.column);
  if (columns.size === 0) return null;
  return el('div', { class: 'column-batch' },
    el('p', { class: 'small muted' }, '依欄首標籤偵測的整欄：'),
    ...[...columns.values()].map((items) => {
      const on = items.filter((it) => it.active).length;
      const cancel = on > 0;
      return el('div', { class: 'add-popup-row small' },
        el('span', {}, `欄首「${items[0].label}」　生效 ${on} / ${items.length}`),
        button(cancel ? '整欄取消' : '整欄加回', () => {
          let blocked = 0;
          for (const it of items) {
            if (it.active !== cancel) continue;
            try {
              toggleItem(d.items, it.id);
            } catch {
              blocked++; // overlaps an item that is active now
            }
          }
          if (blocked) toast(`${blocked} 筆與其他項目重疊，未加回`, 'info');
          markDirty(d);
          refresh();
        }, 'btn btn-small'));
    }),
  );
}

function locate(preview             , id        )       {
  const node = preview.querySelector             (`[data-id="${id}"]`);
  if (!node) return;
  node.scrollIntoView({ block: 'center', behavior: 'smooth' });
  node.classList.add('flash');
  setTimeout(() => node.classList.remove('flash'), 1200);
}

// ---------------------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------------------
/** FR-002: a lone download whose partner was taken from an older version would not restore. */
function warnIfStale(partnerVer        , d          , partner        )       {
  if (partnerVer >= 0 && partnerVer !== d.version) {
    toast(`之前下載的${partner}是舊版本，和這次的檔案對不起來，請重新下載${partner}`, 'error', 8000);
  }
}

async function saveDoc(d          )                {
  const { edits, links, opts } = redact(d);
  const blob = await generateDocument(d.doc, edits, links, opts);
  downloadBlob(blob, outputFileName(d.doc.fileName, 'deid'));
  d.docVer = d.version;
}

function saveCsv(d          )       {
  const { mapping } = redact(d, 'code');
  downloadBlob(new Blob([serializeMapping(mapping)], { type: 'text/csv;charset=utf-8' }), mappingFileName(d.doc.fileName));
  d.csvVer = d.version;
}

/** jill_deid patch (P1-4): fail closed (spec §3.3) — a rule skipped by the watchdog may have left personal data. */
function confirmSkipped(docs)          {
  const names = [...new Set(docs.flatMap((d) => d.skipped ?? []))];
  return names.length === 0 || confirm(`規則「${names.join('、')}」執行逾時未完成，結果可能遺漏個資。仍要繼續嗎？`); // xoops-lint-ignore: local confirm, not a server-side delete (spec §6.1)
}

/** The main action: the document and its mapping table together, so the pair always matches. */
async function downloadBoth(d          , root             )                {
  if (!confirmSkipped([d])) return;
  try {
    toast('產生檔案中…', 'info', 2000);
    await saveDoc(d);
    if (restorable()) saveCsv(d);
    toast(restorable() ? '已下載去識別化文件與編碼表' : '已下載去識別化文件', 'success');
    render(root);
  } catch (e) {
    toast((e         ).message, 'error', 7000);
  }
}

async function downloadDoc(d          , root             )                {
  if (!confirmSkipped([d])) return;
  try {
    toast('產生檔案中…', 'info', 2000);
    await saveDoc(d);
    warnIfStale(d.csvVer, d, '編碼表');
    render(root);
  } catch (e) {
    toast((e         ).message, 'error', 7000);
  }
}

function downloadCsv(d          , root             )       {
  saveCsv(d);
  warnIfStale(d.docVer, d, '去識別化文件');
  render(root);
}

function downloadMerged()       {
  downloadBlob(new Blob([serializeMapping(mergedMapping())], { type: 'text/csv;charset=utf-8' }), MERGED_MAPPING_NAME);
  toast('合併編碼表涵蓋匯入的編碼與本批所有編碼，下次處理時可再匯入沿用；請妥善保管', 'success', 5000);
}

async function copyText(d          )                {
  if (!confirmSkipped([d])) return;
  const { redactedText } = redact(d);
  try {
    await navigator.clipboard.writeText(redactedText);
    toast(restorable() ? '已複製去識別化文字（編碼表仍需另外下載才能還原）' : '已複製去識別化文字', 'success', 4000);
  } catch {
    toast('無法存取剪貼簿，請改用下載', 'error');
  }
}

/** Every document plus its mapping table in one archive (see formats/batch.ts). */
async function downloadAll(root             )                {
  if (!confirmSkipped(state.docs)) return;
  try {
    toast(`打包 ${state.docs.length} 個檔案中…`, 'info', 3000);
    const { blob } = await buildArchive(state.docs.map((d) => ({ doc: d.doc, items: d.items, redact: (style) => redact(d, style) })),hasMergedTable() ? mergedMapping() : undefined, state.marker);
    for (const d of state.docs) {
      d.docVer = d.version;
      d.csvVer = d.version;
    }
    const stamp = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '-');
    downloadBlob(blob, `去識別化-${stamp}.zip`);
    toast(restorable() ? '已打包下載全部檔案與編碼表' : '已打包下載全部去識別化文件', 'success');
    render(root);
  } catch (e) {
    toast((e         ).message, 'error', 7000);
  }
}
