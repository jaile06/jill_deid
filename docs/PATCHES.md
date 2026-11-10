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
| P1-1 | `formats/pdf.js` | `GlobalWorkerOptions.workerPort` 整頁共用一個 module worker，取代 `workerSrc` | 每份文件重抓 worker，`no-cache` 下斷網處理第二份 PDF 失敗（spec §4、§9.1） | `tools/e2e.mjs` 斷網項目 |

## 待辦

- 上游 `core/`、`formats/` 拋出的中文錯誤訊息原樣顯示（spec §4 i18n）。

## 上游測試移植對照（Phase 3a 填）

| 上游測試 | 處置 | 原因 |
|---|---|---|
