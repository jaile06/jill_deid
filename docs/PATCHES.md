# 對上游的修改（spec §4）

基準是 `tools/strip-upstream.mjs` 對上游 commit `1f7b9298` 的轉換結果（含 v3.7 的佈景相容調整）。
比對方式：把轉換工具輸出到暫存目錄，與 `assets/js/upstream/`、`assets/css/upstream.css` 做 `diff -r`；差異只能是下表列出的修改，清單外的修改要先提問。
程式內以 `jill_deid patch (PATCHES.md <#>)` 註解標出位置。

| # | 檔案 | 修改 | 原因 | 測試 |
|---|---|---|---|---|
| P0-1 | `formats/docx.js` | `extractPart` 把 part 起點存成 `part.offset`，`generateDocx` 以它重新擷取 | 上游以第一個 `<w:t>` 的位置當起點，part 開頭有空段落、`<w:tab/>`、`<w:br/>` 時替換整體錯一格：輸出 `身分證[身分證:x]9[姓名:y]明`，末碼外洩，預覽卻正確 | H20 |
| P0-2 | `formats/xlsx.js`、`formats/index.js` | 數值儲存格（無 `t` 或 `t="n"`，且沒有 `<f>`）納入文字，只有被改到的格子轉成 inlineStr；`formatLimitations` 的 Excel 說明同步更新 | 名冊的學號、座號多為數值格，上游完全不讀，原值留在輸出檔 | H21 |
| P0-3 | `core/detector.js` | `resolveOverlaps` export，改為二分搜尋插入點、只比左右鄰居 | 上游為 O(n²)：20,000 列名冊偵測 9,592 ms → 346 ms（V8） | H25 |

## 待辦

- 上游 `core/`、`formats/` 拋出的中文錯誤訊息原樣顯示（spec §4 i18n）。

## 上游測試移植對照（Phase 3a 填）

| 上游測試 | 處置 | 原因 |
|---|---|---|
