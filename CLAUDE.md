# jill_deid — AI 協作須知

- **唯一事實來源**：`docs/spec.md`（規格書 v3.6）。與 convention 衝突以 spec 為準。
- 通用規範：`g:\我的雲端硬碟\note\Templates\開發範本\OpenSpec-XOOPS-convention.md`、`XOOPS-安全開發檢查清單.md`。
- 一次只做一個 Phase（spec §8），每個 Phase 一個分支；合併前 `./check.ps1` 全過（含 headless Chrome 跑 `tests/browser/`，需本機站台）。
- PHP：`E:\my_xoops274\core\php83\php.exe`；lint：`php D:/workspace/02_Tools/xoops-lint/xoops-lint.php .`

## 目前進度

| Phase | 狀態 |
|---|---|
| 1a 骨架 | 已合併 main |
| 1b 前端驗證 | 分支 `phase-1b`：轉換只取 core/formats、P0 修補、瀏覽器測試頁 15/15 已完成；H15 上游殘留已記錄；**待人工**：佈景內五種格式＋OCR、§9.1 HAR 與斷網（含第二份 PDF） |

## 本模組特有的鐵則（spec 摘要，細節回 spec 查）

- `pattern`、`retention`、`custom_config` 一律 `Request::getText(name, '', 'POST')`，**禁 `getString`**（會破壞 regex，spec §B）。
- 刪除／切換走 POST 表單＋token，**不用 `SweetAlert::render()`**（只能 GET，spec §6.2）。
- 權限：寫入 op 依序 POST → `xoops_security_check()` → `$xoopsUser->isAdmin($xoopsModule->mid())`；不看 `$_SESSION`。
- 介面全部自寫（樣板＋Bootstrap＋語言常數＋`<template>`），上游只用 `core/`、`formats/`，不得引用上游 `ui/`、`styles.css`（spec §4、§6.1）。
- 前台 `index.php` 走一般 XOOPS 流程、套佈景、不送 CSP（spec v3.4 §6.1，2026-11-10 修訂）；標題從 `<h3>` 起；零外傳只靠 §9.1 HAR 實測把關。
- PHP 不接收文件：不讀 `$_FILES`、不寫 `uploads/`。
- 改上游 `assets/js/upstream/` 先看 `docs/PATCHES.md`；清單外先問。vendor 由用到的模組 import，`index.php` 不 addScript。

## AI 犯過的錯（每個 Phase 結束時補）

- （Phase 1a）maker 產出的 CRUD 含 `$$key`、GET 刪除、session 權限判斷，已整批移除；Phase 2 依 spec 手寫，不要從 git 歷史撈回來。
- （Phase 1b）**預覽正確不代表輸出正確**：上游 DOCX 輸出位移、XLSX 數值格不讀，都是預覽對、檔案漏。格式相關修改一律以「輸出檔重新解析後 === 預覽文字」驗證（`tests/browser/patches.test.js`）。
- （Phase 1b）regex 字元類 `[^&#]+` 這類「排除式」會跨空白、換行吞到文件尾；規則一定要在內文（不只 URL）上測。
- （Phase 1b）**Word 產生的測試檔會帶真實姓名**：作者、最後修改者、修訂者（`docProps`、`w:author`、`people.xml`）都取自登入的 Office 帳號，只改 `UserName` 無效。一律用 `tools/make-h15.ps1` 的作法（暫時開 `UseLocalUserInfo`＋虛構名稱，結束還原），提交前以 leak-check 搜尋真實姓名。
