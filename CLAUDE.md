# jill_deid — AI 協作須知

- **唯一事實來源**：`docs/spec.md`（規格書 v3.8）。與 convention 衝突以 spec 為準。
- 通用規範：`g:\我的雲端硬碟\note\Templates\開發範本\OpenSpec-XOOPS-convention.md`、`XOOPS-安全開發檢查清單.md`。
- 一次只做一個 Phase（spec §8），每個 Phase 一個分支；合併前 `./check.ps1` 全過（含 headless Chrome 跑 `tests/browser/`，需本機站台），並跑 `node tools/e2e.mjs`（兩個佈景的實際流程＋HAR＋斷網＋Word／Excel 開檔）。
- PHP：`E:\my_xoops274\core\php83\php.exe`；lint：`php D:/workspace/02_Tools/xoops-lint/xoops-lint.php .`

## 目前進度

| Phase | 狀態 |
|---|---|
| 1a 骨架 | 已合併 main |
| 1b 前端驗證 | 已合併 main（2026-11-10）：上游介面掛載於佈景、P0／P1 修補、瀏覽器測試 19/19、`tools/e2e.mjs` 兩個佈景 PASS（五種格式＋OCR、ZIP、HAR、斷網第二份 PDF） |
| 2 後台 | 已合併 main（2026-11-10）：Rule、Preset、Config、後台樣板、規則包；使用者已更新模組並在後台操作確認 |
| 3a 前端基礎 | 已合併 main（2026-11-10）：單一 Worker 偵測（看門狗、fail closed）、機構規則併入、情境下拉與策略對照、欄首標籤偵測；瀏覽器 47/47＋3/3、e2e 兩個佈景 PASS（名冊 12/12）。上游測試移植移到 4d |
| 3b-1 URI 核心 | 已合併 main（2026-11-10）：`jill/uri-scan.js`（`scanUri`、`restoreUri`、文字層編碼片段）、內建規則 16 `url`、`docs/marker-in-uri.md`；瀏覽器 62/62＋3/3、e2e 兩個佈景 PASS |
| 3b-2 Markdown | 已合併 main（2026-11-10）：`jill/links/markdown.js`（連結網址排除一般偵測、輸出時 `scanUri` 改寫或 strip）、process-view `redact()` 統一輸出出口；瀏覽器 69/69＋3/3、e2e 兩個佈景 PASS（含 `links.md` 零殘留） |
| 3b-3 DOCX | 已合併 main（2026-11-10）：`jill/links/docx.js`（rels 每處引用、欄位碼、tooltip、H7 新 rId）、殘留清除（Fallback、修訂、作者、people.xml、docProps）、註腳／尾註／註解納入掃描；H15 零殘留；瀏覽器 79/79＋3/3、e2e 兩個佈景 PASS（`links.docx` 經 Word 開檔驗證） |
| 3b-4 XLSX | 已合併 main（2026-11-10）：`jill/links/xlsx.js`（工作表超連結、內部連結、`HYPERLINK()` 公式、calcChain）、rels 引擎抽成 `links/rels.js` 與 DOCX 共用、註解與作者清除、`detectShort`；瀏覽器 89/89＋3/3、e2e 兩個佈景 PASS（`links.xlsx` 經 Excel 開檔驗證） |
| 3b-5 PDF＋還原核心 | 已合併 main（2026-11-10）：PDF Link 讀取（`writable:false`，一律 strip＋警示）、`jill/links/restore.js`（`restoreDocument`）；H12 Markdown 逐位元組、Word／Excel 範例檔還原一致，H14 解碼後無 `/URI`；瀏覽器 94/94＋3/3、e2e 兩個佈景 PASS |
| 4a 去識別化頁 | 下一步 |

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
- （Phase 2）命令列載入 XOOPS 時，`include/common.php` 以**工作目錄**有沒有 `xoops_version.php` 判斷是否在模組內；在模組目錄執行會渲染「模組不存在」頁並 exit。測試先 `chdir(sys_get_temp_dir())`。
- （Phase 2）headless Chrome 的 `--virtual-time-budget` 會快轉計時器，Worker 看門狗會在 Worker 回應前觸發，測試時好時壞；瀏覽器測試一律用 `tools/browser-tests.mjs`（真實時間）。
- （Phase 2、3b-1 再犯）含反斜線的內容（regex、JSON、命名空間）用 Write／Edit 工具寫檔，不要經 shell heredoc、`node -e` 或 `python -` heredoc，反斜線會被吃掉或改變。
- （Phase 3a）**每次偵測都新建 Worker 會讓斷網失敗**（同 pdf.js 的問題）：`no-cache` 下新 Worker 要重抓模組。長駐的東西（Worker）整頁共用；e2e 的斷網項目會抓到。
- （Phase 3b-1）**裸網址 regex 不能用排除式字元類**：`[^\s<>"']+` 會把緊接在網址後的中文（「。另見」）吞進網址，一併整條遮蔽。中文句子常不空格，網址只收 RFC 3986 字元。
- （Phase 3b-2）**e2e 不可假設站台設定**：站上預設情境是 `strip_link`，連結被移除而非改寫；e2e 只驗「零殘留」，模式差異交給單元測試。Git Bash 的 `tar` 會把 `C:` 當遠端主機，解 zip 用 `C:/Windows/System32/tar.exe`。
- （Phase 3b-3）**DOM 上分組改寫要從原始節點複製**：同一 rId 先改寫再 `cloneNode`，複本會帶著改寫後的值（H7 抓到）。另外，被刪除的節點不能當插入錨點（`rel.after` 對已移除節點無效）。
- （Phase 3b-3）Word 以 COM `Fields.Add` 建的 HYPERLINK 欄位，存檔時會轉成 `w:hyperlink`；拆段欄位碼只能用合成測試（H16）。檢查真實姓名時，Windows 帳號名稱若是 `user` 這類常見字，會誤中 `w15:userId` 屬性名稱，要看命中處再判斷。
- （Phase 3b-4）**站台設定會遮住另一條路徑**：預設情境是 `strip_link`，e2e 只走過「移除連結」；一次性的「改寫網址」檢查才發現 `display` 屬性裡編碼過的姓名外洩。兩種模式都要有測試：改寫模式由單元測試處理同一份 Office 範例檔。
- （Phase 3b-4）**Excel 存檔的作者取自 Office 帳號**：`UserName` 只影響註解作者，`dc:creator`、`cp:lastModifiedBy` 是登入帳號的真實姓名，設 Last Author 也會在存檔時被蓋掉。`tools/make-links-xlsx.ps1` 存檔後直接改 `core.xml`，並檢查整包不再出現該名稱。
- （Phase 3b-4）移除 Excel 公式後要一併處理 `calcChain.xml`，否則 Excel 判定檔案損毀；只看 XML 是否合法抓不到，一定要用 `tools/office-open.ps1` 實際開檔。
