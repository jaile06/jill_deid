# 對上游的修改（spec §4）

基準是 `tools/strip-upstream.mjs` 對上游 commit `1f7b9298` 的轉換結果（含 v3.7 的佈景相容調整）。
比對方式：把轉換工具輸出到暫存目錄，與 `assets/js/upstream/`、`assets/css/upstream.css` 做 `diff -r`；差異只能是下表列出的修改，清單外的修改要先提問。
程式內以 `jill_deid patch (PATCHES.md <#>)` 註解標出位置。

| # | 檔案 | 修改 | 原因 | 測試 |
|---|---|---|---|---|
| P0-1 | `formats/docx.js` | `extractPart` 把 part 起點存成 `part.offset`，`generateDocx` 以它重新擷取 | 上游以第一個 `<w:t>` 的位置當起點，part 開頭有空段落、`<w:tab/>`、`<w:br/>` 時替換整體錯一格：輸出 `身分證[身分證:x]9[姓名:y]明`，末碼外洩，預覽卻正確 | H20 |
| P0-2 | `formats/xlsx.js`、`formats/index.js` | 數值儲存格（無 `t` 或 `t="n"`，且沒有 `<f>`）納入文字，只有被改到的格子轉成 inlineStr；`formatLimitations` 的 Excel 說明同步更新 | 名冊的學號、座號多為數值格，上游完全不讀，原值留在輸出檔 | H21 |
| P0-3 | `core/detector.js` | `resolveOverlaps` export，改為二分搜尋插入點、只比左右鄰居 | 上游為 O(n²)：20,000 列名冊偵測 9,592 ms → 346 ms（V8） | H25 |
| P1-2 | `core/detector.js` | `detect()` 拆成 `scanPattern(text, p)`（單條規則、未解重疊）與 `toItems(text, cands, book)`；`detect` 為兩者組合 | Worker 逐條規則跑並受看門狗監看；主執行緒加入欄首候選後才編碼（spec §3.3、§6.5） | `phase3a.test.js` |
| P1-3 | `core/pattern-store.js` | `STORAGE_KEY` 改 `jill_deid.patternConfig.v1`；`setOrgPatterns()`，`getEffectivePatterns()` 依「內建 → 機構 → 個人」合併，機構規則非 locked 可停用、個人保留設定優先 | 機構規則加入偵測（spec §4、§7） | `presets.test.js` |
| P1-4 | `ui/process-view.js` | 偵測改呼叫 `jill/detect.js`（async：載入、重新偵測、規則變更同步）；`setPresets()`、情境下拉；`effectiveRetention` 依 §3.4（部分保留時機構類別用規則自己的保留方式、自訂加入情境）；類別表的預設值含情境；略過規則時下載／複製前確認 | spec §3.3、§3.4、§6.1 新增 1 | `presets.test.js`、e2e |
| P1-5 | `core/patterns.js`、`core/types.js`、`core/detector.js` | 內建規則 16 `ip-net`（IP 網段與連接埠，`ipNetValid`；spec v3.9 取代原本的個人頁 `url`）；`URL_CATEGORY`、`URL_REGEX`、`trimUrl` 供連結掃描；`CATEGORIES` 加 `網址`（解碼失敗的整段遮蔽）；`toItems`／`resplitItems` 尊重候選的 `fixed`（一律整段隱藏） | IP 網段與連接埠（spec §5.2）；文字層裸網址的編碼片段整段隱藏才能逐位元組還原（spec §5.3，`docs/marker-in-uri.md`） | `uri.test.js` |
| P1-6 | `ui/process-view.js`、`formats/batch.js` | `redact(d, style)` 取代 `applyRedactions(d.doc.text, d.items, …)`（下載文件、編碼表、複製、合併編碼表、打包），以目前的輸出模式、標記、`hyperlinkMode` 呼叫 `scanUri` 改寫文字內的連結目標；`buildArchive` 的 entry 可帶 `redact` | Markdown／貼上文字的連結網址不進一般偵測，必須在每個輸出出口一致改寫（spec §5.5） | `markdown.test.js`、e2e `links.md` |
| P1-7 | `formats/docx.js`、`formats/index.js`、`formats/batch.js`、`ui/process-view.js` | 掃描範圍加 `footnotes.xml`、`endnotes.xml`、`comments.xml`；`parseDocx` 以 `jill/links/docx.js` 的 `docxLinks` 填 `doc.links`，並保存 rels 等原始 XML（`handle.pristine`）；`generateDocx(doc, edits, links)` 每次先還原原始 XML，再 `writeDocxLinks`（rels 改寫／strip、同 rId 不同決定時複製新 rId、欄位碼與 `fldSimple`、`w:tooltip`）與 `scrubDocx`（移除 `mc:Fallback`、`w:del`、`w:moveFrom`，清空 `w:author`／`w:initials`、`people.xml`、`docProps`）；`generateDocument`、`buildArchive` 傳遞 `links`；`redact()` 對 DOCX 改用 `redactLinks`（`jill/links/rels.js`，與 XLSX 共用；tooltip 走一般偵測） | 連結目標不在 `text` 內；上游輸出殘留文字方塊、追蹤修訂與作者（spec §5.5 DOCX 1–8，H15） | `docx.test.js`、`h15.test.js`、e2e `links.docx`＋`tools/office-open.ps1` |
| P1-8 | `formats/xlsx.js`、`formats/index.js`、`ui/process-view.js` | 註解（`xl/comments*.xml` 的 `<t>`、`xl/threadedComments/*` 的 `<text>`）納入掃描並原地改寫；`parseXlsx` 以 `jill/links/xlsx.js` 填 `doc.links`（工作表 `<hyperlink>` 的 rels 目標與 `display`／`tooltip`／`location`、無 `r:id` 的內部連結、`HYPERLINK()` 公式），保存原始 XML；`generateXlsx(doc, edits, links)` 每次先還原，寫回連結；公式被移除時刪 `calcChain.xml`（含關係與 content type）；清空註解作者、`xl/persons` 的 `displayName`／`userId`、`docProps`；`formatLimitations` 的 Excel 說明更新；`redact()` 的連結文字改用 `jill/detect.js` 的 `detectShort`（含網址編碼片段） | spec §5.5 XLSX 1–4、H8；公式被移除後 `calcChain` 仍指向該格，Excel 判定檔案損毀 | `xlsx.test.js`、e2e `links.xlsx`＋`tools/office-open.ps1` |
| P1-9 | `formats/pdf.js`、`ui/process-view.js` | `parsePdf` 以 `page.getAnnotations()` 列出 Link 的 `unsafeUrl`（`writable: false`）；`redact()` 對 PDF 也走 `redactLinks`：PDF 連結一律 `strip`，含個資者警示 `pdf`（介面在 4a） | 輸出重建本來就不帶連結，但使用者要知道哪些連結會消失（spec §5.5 PDF、H14） | `restore.test.js` |
| P1-10 | `ui/process-view.js`、`core/detector.js`、`formats/index.js`、`formats/batch.js`、`formats/docx.js`、`formats/xlsx.js` | 輸出設定新增「超連結」（`mask_pii_in_url`／`strip_link`）與「文件屬性」（清除作者等，預設勾選）；預覽中含個資連結後插入 `🔗`（Word、TXT、Markdown；以 `jill/preview-insert.js` 插在顯示文字之後），Excel、PDF 與沒有顯示文字的連結列在「文件連結」；彈出層與清單對照原連結與輸出、顯示警示，可「取消去識別化」「移除連結」「恢復自動處理」（`d.linkChoices`，`redact()` 的 `decide(uri, link)` 先看使用者選擇）；標記非「編碼」時提示連結會移除（H11）；偵測清單每項標示來源（規則／欄首「標籤」／手動），欄首項目可整欄取消或加回；`toItems` 帶上欄首候選的 `column`、`label`；`generateDocument(doc, edits, links, opts)` 的 `opts.keepProps` 傳到 `scrubDocx`、`scrubXlsx` | spec §5.4、§5.5 DOCX 7、§6.1 新增 2、3、7 | `process-ui.html`、e2e |
| P1-11 | `formats/docx.js`、`ui/preview.js` | 段落的 `part` 增加 `footnote`、`endnote`、`comment`；預覽以框線分開並標「註腳」「章節附註」「註解」，略過其中的空段落（Word 的註腳分隔線） | 3b-3 起註腳與註解納入掃描後，預覽把它們混在本文中（使用者 2026-11-10 要求標示） | `docx.test.js` |
| P1-12 | `ui/patterns-view.js` | 「機構共用規則」分組（沒有就不顯示）：開關與內建規則共用 `setBuiltinEnabled`，locked 者開關停用、「全部啟用」略過；詳細資料顯示來源、是否必須啟用、是否檢查網址；「測試網址」框以 `jill/uri-scan.js` 的 `explainUri`／`scanUri` 列出各部分的原始值、解碼值、命中與輸出 | spec §6.1 新增 4、§9.3 第 4 項 | `patterns-ui.html` |
| P1-13 | `ui/restore-view.js` | 還原改用 `jill/links/restore.js` 的 `restoreDocument`（內文＋連結目標＋連結文字），下載時把 `links` 交給 `generateDocument`；結果列出「已還原的連結」；「找不到編碼標記」的提示也看連結內的編碼 | 3b-5 的還原核心接上還原頁（spec §5.3、H12 經介面） | `restore-ui.html` |
| P1-14 | `ui/samples.js` | 範例清單加入本模組的 `hyperlinks.docx`、`hyperlinks.xlsx`、`hyperlinks.md`（`tools/make-links-*.ps1` 產生，作者為虛構名稱） | spec §6.1 新增 5 | `upstream/index.html`（`ui` 測試）、e2e |
| P1-15 | `ui/process-view.js`、`ui/patterns-view.js` | 工作區的「檔案」「去識別化預覽」「偵測項目」由 `h5` 改 `h4`（上游的「上傳文件」只在空白時出現，原本 h3 後直接接 h5）；規則分組的「全部啟用」移出 `<summary>`，由 `jill_deid.css` 疊回標頭列（分組收合時不顯示） | spec §9.4：標題不跳階；axe `nested-interactive` | `tools/e2e.mjs`（`tools/a11y.mjs`） |
| P1-16 | `ui/process-view.js` | 純圖示按鈕（檔案的「×」、預覽中的「🔗」）：圖示 `aria-hidden`，名稱改為 `.visually-hidden` 文字（樣式在 `jill_deid.css`）；按鈕沒有 `data-start`，預覽圈選的位置換算不受影響 | spec §9.4 | `tools/a11y.mjs`（純圖示檢查） |
| P1-1 | `formats/pdf.js` | `GlobalWorkerOptions.workerPort` 整頁共用一個 module worker，取代 `workerSrc` | 每份文件重抓 worker，`no-cache` 下斷網處理第二份 PDF 失敗（spec §4、§9.1） | `tools/e2e.mjs` 斷網項目 |

## 待辦

- 上游 `core/`、`formats/` 拋出的中文錯誤訊息原樣顯示（spec §4 i18n）。

## 上游測試移植對照（Phase 4d）

以 `node tools/port-upstream-tests.mjs <upstream-root>` 轉成 `tests/browser/upstream/`（32 個測試檔，369 項全過）；vitest 與 `node:fs` 由 `vitest-shim.js` 代替。未列出者原樣移植。

| 上游測試 | 處置 | 原因 |
|---|---|---|
| `unit/seo.test.ts` | 不移植 | 檢查上游的 `index.html`，本模組不使用 |
| `unit/pattern-store.test.ts` | 改儲存鍵為 `jill_deid.patternConfig.v1` | P1-3 |
| `unit/patterns-view.test.ts` | 國際與通用格式 9 條（加 `url`）、多「測試網址」框、標題 `h3`→`h5` | P1-5、P1-12、§4 標題降級 |
| `integration/roundtrip-xlsx.test.ts` | 原始電話 `912345678` 改為「出現在文字中」 | P0-2：數值格會讀取 |
| `integration/roundtrip-realistic.test.ts` | 數值欄「累計消費」改為「出現在文字中」 | P0-2 |
| `integration/roundtrip-ocr.test.ts` | 改用站上的 `parsePdf(..., { ocr: {} })` 辨識範例；FR-012 檢查略過純空白片段 | 瀏覽器單次 Tesseract 只讀到 84.7%（門檻 90%），站上流程 95.1%；門檻不變 |
