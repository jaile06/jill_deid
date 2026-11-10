# jill_deid — AI 協作須知

- **唯一事實來源**：`docs/spec.md`（規格書 v3.7）。與 convention 衝突以 spec 為準。
- 通用規範：`g:\我的雲端硬碟\note\Templates\開發範本\OpenSpec-XOOPS-convention.md`、`XOOPS-安全開發檢查清單.md`。
- 一次只做一個 Phase（spec §8），每個 Phase 一個分支；合併前 `./check.ps1` 全過（含 headless Chrome 跑 `tests/browser/`，需本機站台），並跑 `node tools/e2e.mjs`（兩個佈景的實際流程＋HAR＋斷網）。
- PHP：`E:\my_xoops274\core\php83\php.exe`；lint：`php D:/workspace/02_Tools/xoops-lint/xoops-lint.php .`

## 目前進度

| Phase | 狀態 |
|---|---|
| 1a 骨架 | 已合併 main |
| 1b 前端驗證 | 已合併 main（2026-11-10）：上游介面掛載於佈景、P0／P1 修補、瀏覽器測試 19/19、`tools/e2e.mjs` 兩個佈景 PASS（五種格式＋OCR、ZIP、HAR、斷網第二份 PDF） |
| 2 後台 | 下一步，分支 `phase-2` |

## 本模組特有的鐵則（spec 摘要，細節回 spec 查）

- `pattern`、`retention`、`custom_config` 一律 `Request::getText(name, '', 'POST')`，**禁 `getString`**（會破壞 regex，spec §B）。
- 刪除／切換走 POST 表單＋token，**不用 `SweetAlert::render()`**（只能 GET，spec §6.2）。
- 權限：寫入 op 依序 POST → `xoops_security_check()` → `$xoopsUser->isAdmin($xoopsModule->mid())`；不看 `$_SESSION`。
- **介面沿用上游 `ui/`**（v3.7，使用者 2026-11-10 決定，取代 v3.5 自寫）：佈景相容靠轉換工具（標題降級、body→`#jill-deid-portal`、CSS 限定範圍）＋ `jill_deid.css`；本模組新增功能以修補加在上游 `ui/`，記入 PATCHES.md。`upstream.css` 勿手改。
- 前台 `index.php` 走一般 XOOPS 流程、套佈景、不送 CSP（spec v3.4 §6.1，2026-11-10 修訂）；標題從 `<h3>` 起；零外傳只靠 §9.1 HAR 實測把關。
- PHP 不接收文件：不讀 `$_FILES`、不寫 `uploads/`。
- 改上游 `assets/js/upstream/` 先看 `docs/PATCHES.md`；清單外先問。vendor 由用到的模組 import，`index.php` 不 addScript。

## AI 犯過的錯（每個 Phase 結束時補）

- （Phase 1a）maker 產出的 CRUD 含 `$$key`、GET 刪除、session 權限判斷，已整批移除；Phase 2 依 spec 手寫，不要從 git 歷史撈回來。
- （Phase 1b）**預覽正確不代表輸出正確**：上游 DOCX 輸出位移、XLSX 數值格不讀，都是預覽對、檔案漏。格式相關修改一律以「輸出檔重新解析後 === 預覽文字」驗證（`tests/browser/patches.test.js`）。
- （Phase 1b）regex 字元類 `[^&#]+` 這類「排除式」會跨空白、換行吞到文件尾；規則一定要在內文（不只 URL）上測。
- （Phase 1b）**Word 產生的測試檔會帶真實姓名**：作者、最後修改者、修訂者（`docProps`、`w:author`、`people.xml`）都取自登入的 Office 帳號，只改 `UserName` 無效。一律用 `tools/make-h15.ps1` 的作法（暫時開 `UseLocalUserInfo`＋虛構名稱，結束還原），提交前以 leak-check 搜尋真實姓名。
- （Phase 1b）**佈景的網路字型是旁路外洩**：佈景從 Google Fonts 以 unicode-range 切片載入字型，本模組 CSS 只要指名同名字型（上游的 'Noto Sans TC'），瀏覽器就依文件內容去抓分片。CSS 只用系統字型；改佈景或 CSS 後跑 `node tools/e2e.mjs`。
- （Phase 1b）佈景的 Google 翻譯小工具會把整頁送出，本模組頁已在 `index.php` 拿掉；新佈景要確認同類小工具。HAR 時間比對要用毫秒（`strtotime` 只到秒，會誤判）。
