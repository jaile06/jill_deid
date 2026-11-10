---
title: "XOOPS 模組開發規格書：文件去識別化工具（jill_deid）"
version: 3.8
created: 2026-11-06
updated: 2026-11-10
upstream: "https://github.com/dean9703111/data-deidentification @ 1f7b9298f94a9728cf6d181f84cfcce48c39d968（2026-10-16，MIT）"
baseline: "E:\\my_xoops274\\www（XOOPS 2.7.4、Smarty 4.5.8、TadTools 4.0.8-Stable、PHP 8.3）"
tags:
  - XOOPS
  - 規格書
  - OpenSpec
  - 資料去識別化
  - 資安
related_concepts:
  - "[[資料去識別化]]"
  - "[[XOOPS開發規範]]"
  - "[[OpenSpec]]"
  - "[[規範驅動開發SDD]]"
  - "[[應用程式安全五問]]"
  - "[[PHP-XOOPS安全掃描流程]]"
  - "[[對比度測試]]"
related_entities:
  - "[[data-deidentification]]"
---

# XOOPS 模組開發規格書：文件去識別化工具（`jill_deid`）

## 給 AI 的閱讀指引

1. 本文是唯一事實來源。MUST 為硬性要求；SHOULD 可取捨，但要在 PR 說明。
2. 動工前先讀這些檔案，本文不重抄：
   - 通用規範：`Templates/開發範本/OpenSpec-XOOPS-convention.md`、`Templates/開發範本/XOOPS-安全開發檢查清單.md`
   - 寫法範本：`E:\my_xoops274\www\modules\dinfo\`（`class/Tools.php`、`preloads/autoloader.php`、`admin/`）。`Tools.php` 可依本模組需要精簡後沿用。
   - TadTools 原始碼：`E:\my_xoops274\www\modules\tadtools\class\`。遇到不確定的 API 先讀原始碼，不要猜。
3. 本文與 convention 衝突時以本文為準，衝突處會明寫。
4. 上游程式碼取 frontmatter 所列 commit。§A 是已對照原始碼的事實，與實際程式不符時停下來回報。
5. 一次只做一個 Phase（§8），通過該 Phase 驗收才進下一個。
6. 標 `【待確認】` 的值先照草案實作並集中放置，不要因此停工；其餘未定義的行為一律提問，不要自行決定。
7. **已定案，不要重新提議**（2026-11-06 使用者確認；2026-11-10 修訂前台）：前台走一般 XOOPS 流程、套佈景，不做獨立頁、不送 CSP（§6.1）；**前台直接沿用上游介面 `ui/`、`styles.css` 與範例檔，只由轉換工具做佈景相容調整；不用 `main.ts`**（§4、§6.1，v3.7）；`mask_whole_url` 延後；基準為 XOOPS 2.7.4、PHP 8.3，不支援 2.5.11；資料表用 MyISAM；校務資料涵蓋學號、座號、員編、文號、身分證號、姓名、EMAIL（§6.4）；骨架由 `tad_xmod_maker` 產生；前台為 PHP＋原生 JS，開發與上線都不用 Node 建置（§4）。**v3.6（2026-11-10）使用者核准**：上游 P0 修補（DOCX offset、XLSX 數值格、`resolveOverlaps` 效能，§4）；偵測整段在單一 module worker（§3.3）；vendor 改由用到的模組自行 import（§4）；欄首標籤偵測（§6.5）；規則包修正（§6.4）。**v3.7（2026-11-10）使用者決定**：上游介面功能齊全（README「操作流程」步驟 1–7），改回沿用上游 `ui/` 與範例檔，取代 v3.5 的「介面自寫」；本模組新增功能以修補方式加在上游 `ui/`；xbootstrap5 下 TadTools 的警告不修（§9.1）。
8. §A 的路徑與行號指上游 TypeScript 原始碼；`core/`、`formats/`、`ui/` 對應本模組 `assets/js/upstream/` 下的同名 `.js`；`styles.css` 對應轉換工具產生的 `assets/css/upstream.css`。

---

## A. 上游事實（已對照原始碼）

| 項目 | 事實 | 位置 |
|---|---|---|
| 技術棧 | Vite 8（Node `^20.19 \|\| >=22.12`）、TypeScript 7、無框架、vitest＋jsdom，33 個測試檔 | `package.json` |
| 內建規則 | 15 條。`tw` 7 條：`zh-name tw-id tw-mobile tw-landline tw-address tw-company tw-tax-id`；`intl` 8 條：`email us-ssn intl-phone credit-card iban ipv4 ipv6 dob`。可含 `validate` 函式（檢核碼），無法經 `postMessage` 傳送；module worker 可直接 import 本檔（§3.3） | `core/patterns.ts` |
| 類別 | `CATEGORIES` 是封閉清單，型別也是 union；UI 用它產生下拉選單與類別統計（`process-view.ts:597,664,843`），不在清單內的類別不會出現在統計與批次取消 | `core/types.ts` |
| 標記 | `[類別:6碼小寫hex]`，regex `\[([^\[\]:]{1,10}):([0-9a-f]{6})\]` | `core/codes.ts` |
| 編碼共用 | `CodeBook` 鍵為 `類別:head:tail:原值`。同值但保留長度不同，編碼就不同 | `core/codes.ts` |
| CSV | `code,category,original[,kept_prefix,kept_suffix]`；`original` 只存被隱藏的部分。還原只以 `code` 查表 | `core/csv.ts`、`core/restorer.ts` |
| 偵測 | `detect(text, patterns, book)` 為**同步**函式，在主執行緒執行；重疊時最長者優先（`resolveOverlaps` 未 export）。呼叫點：`process-view.ts:239,279`。**`resolveOverlaps` 為 O(n²)**：實測 5,000 列名冊 239 ms、20,000 列 9.6 s（主執行緒凍結），8.2 萬候選單此函式 3.3 s（§4 修補） | `core/detector.ts` |
| 管線 | 全部以 `LoadedDocument.text` 的 **offset** 運作（`RedactionItem.start/end`、`TextEdit`）。超連結 URI 不在 `text` 裡，**現行管線碰不到** | `core/types.ts` |
| 輸出模式 | `OutputMode = 'code'（全部隱藏）\|'preview'\|'custom'`；`MarkerStyle = 'code'\|'label'\|'blank'`。`preview` 對所有類別套 `standardSplit`，未知類別預設露出第 1 字；`custom` 為 `overrides[類別] ?? it.retention`，未設定則全部隱藏。這段邏輯在 UI 層（本模組沿用），§3.4 策略對照以修補方式加在這裡 | `ui/process-view.ts:101-111` |
| 個人規則 | `localStorage` key `deid.patternConfig.v1`：`{version, disabledBuiltins, customPatterns, retention?}` | `core/pattern-store.ts` |
| 上限 | `MAX_FILES = 10`（UI 層）、`MAX_FILE_BYTES = 100MB` | `process-view.ts:16`、`types.ts` |
| 資產路徑 | `BASE_URL`（`./`）以 **document 網址**解析，共 3 處：`pdf.ts:14` 字型、`ocr.ts:605` OCR、`samples.ts:11` 範例（沿用上游範例清單與 `assets/samples/`）；轉換後皆為 `assetsBase` | 見左 |
| DOCX | 只解析 `document.xml`、`header*`、`footer*` 的 `<w:t>`。**`mc:Fallback` 與 `w:del` 被跳過，內容原樣留在輸出檔**。**輸出時以第一個 `<w:t>` 的位置當 part 起點**：part 開頭有空段落、`<w:tab/>`、`<w:br/>` 時替換位置整體錯一格，實測輸出 `身分證[身分證:x]9[姓名:y]明`（末碼、末字外洩），**預覽卻正確**（§4 修補） | `formats/docx.ts` |
| XLSX | 只處理 `t="s"`、`inlineStr` 儲存格；**數值儲存格（無 `t` 或 `t="n"`）不讀**，名冊的學號、座號原值留在輸出檔（§4 修補）；公式快取（`t="str"`）不讀；未被引用的 sharedStrings 已會清空 | `formats/xlsx.ts` |
| 版面資訊 | `LoadedDocument.layout`：XLSX 每格有 `row`、`col`（`sheets[].cells`）；DOCX 段落有 `table:{id,row,col}`（`paragraphs[]`）。§6.5 用 | `formats/xlsx.ts`、`docx.ts` |
| PDF | 以 `PDFDocument.create()` 重建，原 Annotation、Outline、Info 不會帶出 | `formats/pdf.ts` |
| TXT／MD | 整段純文字，沒有連結語法意識 | `formats/plaintext.ts` |
| UI 入口 | `main.ts` 匯入即 `mount()`，內含 `h1`、作者社群連結、`innerHTML`、FAQ dialog，**只能取代，不能包裝**。本模組以 `jill/main.js` 取代。各分頁用 `h2`、`h3`；`ui/*.js` 有 3 處原生 `confirm()`、寫死中文，**沒有 `innerHTML`**；7 處把元素掛在 `<body>`（tooltip、toast、處理中遮罩、提示 dialog、OCR 畫面、圈選浮窗、複製用 textarea）。`styles.css` 含 `:root`（`font-size: 15px`）、`*`、`body`、`h1`–`h3` 全域選擇器（Phase 1b 實測：套佈景時 255 個佈景元素中 230 個字級被改）。佈景 Bootstrap 有 10 個同名 class（`.active .badge .btn .btn-danger .btn-primary .mark .small .table .toast .tooltip`），其中 `.toast:not(.show)` 被隱藏、`.tooltip` 透明度 0。處理方式見 §4 轉換與 §6.1 | `src/main.ts`、`src/ui/`、`src/styles.css` |
| UI 對 core 的依賴 | `core/`、`formats/` 不 import `ui/`（已驗證），UI 層可整層拿掉 | — |
| OCR | 已指向同站資產，但 `tesseract.js` 程式內仍有 jsDelivr 預設網址字串（有傳路徑時不會連線）；預設以 blob URL 啟動 worker | `formats/ocr.ts:605-612` |

## B. XOOPS 基準事實（`E:\my_xoops274\www` 已驗證）

| 項目 | 事實 |
|---|---|
| 版本 | XOOPS 2.7.4、Smarty 4.5.8、`xoops_lib` 位於 `E:\my_xoops274\xoops_lib`。可用 PHP：`E:\my_xoops274\core\php8{1..5}\php.exe` |
| TadTools | 4.0.8-Stable，`min_php = 8.3` |
| Smarty | 沒有開啟自動跳脫，輸出須明寫 `\|escape`。`nofilter` 語法有效但多餘，JSON 區塊直接輸出變數即可。未註冊的 PHP 函式當 modifier 會觸發 Deprecated |
| `Xmf\Request::getString` | **會破壞 regex**：實測 `(?<!\d)1` → `(?!\d)1`（語意反轉）、`(?<y>\d{4})` → `(?\d{4})`、`a<b>c` → `ac`。`Request::getText` 三者皆保留 |
| 模組存取權 | `include/common.php` 已自動檢查 `module_read`，模組內不必重寫 |
| 佈景 | `xswatch5`、`xbootstrap5` 的 `theme.tpl` 含行內 `<script>`；SweetAlert 也以行內 JS 輸出。套嚴格 CSP 會壞。**頁面載入時有第三方 GET**：xswatch5 的 Bootswatch 版型 CSS `@import` Google Fonts，school2022 預設設定載入 Google Fonts（§0 INV-1） |
| `SweetAlert::render` | 確認後一律 `location.href`（GET），**無法滿足本模組的 POST 要求**，見 §6.2 |
| `FormValidator` | `__construct($id='', $show_jquery=true)`、`render($Position='topRight')`。須寫 `(new FormValidator('#f', true))->render();`，PHP 8.4 以前不接受省略括號 |
| `Utility` | `xoops_security_check($file='', $line='', $redirect_to='')`；`token_form($mode='assign')`；`web_error($sql, $file='', $line='', $force=false)`；`getPageBar($sql, $show_num, $page_list, ...)` |
| Lint | `php D:/workspace/02_Tools/xoops-lint/xoops-lint.php <模組目錄>`，會略過 `node_modules`、`vendor`、`fonts`、`*.min.*` |
| 資料表 | dinfo 全為 MyISAM，本模組跟隨 |

---

## 0. 威脅建模

1. **最重要的資產**：使用者原始文件、超連結內的個資、`*.mapping.csv`。解析、OCR、遮罩、還原全部在瀏覽器記憶體內完成；PHP 不存在接收文件的端點，不讀 `$_FILES`，不寫 `uploads/`，DB 不存文件內容。
2. **誰能碰什麼**：有 `module_read` 的群組可用前台，個人規則只存瀏覽器。模組管理員（`module_admin`）管理機構規則與情境。
3. **管不到的段落**：前端相依套件與 OCR 模型全部打包同站提供，禁止執行期連外。`locked` 規則只是操作防呆，不是安全邊界，因為使用者控制自己的瀏覽器。
4. **不變量（MUST）**：
   - **INV-1 零外傳**：不得有帶文件內容的請求。具體為：(a) 任何請求都沒有 body，URL 與標頭不含樣本值；(b) 本模組自己發出的請求只有同站 `GET` 靜態資產；(c) 選取第一個檔案（或貼上文字）之後，不得出現任何第三方請求。頁面載入時佈景的第三方 `GET`（Google Fonts 等，§B）此時還沒有文件內容，且 `Referrer-Policy: no-referrer` 不帶出網址，不違反本條。前台套佈景，佈景與區塊的 JS 與文件內容同源、可讀取預覽內容，且無 CSP 可擋，**驗收完全以 §9.1 實測為準**；佈景、區塊有變動時須重跑。
   - **INV-2 超連結零殘留**：URI 命中個資時，§5.5 清單內的位置不得出現原值的原文、percent-encoded、XML escape、HTML entity 任一形式。
   - **INV-3 規則安全**：任何機構或自訂規則都不能讓分頁失去回應（§3.3）。
   - **INV-4 DB 無個資**：只存規則與情境；`sample_text` 只能放虛構範例，表單要提示。
5. **對外入口**：前台 `index.php` 只讀；後台 `admin/main.php` 的 `rule_*`、`preset_*`。

---

## 1. 專案基本資訊

| 欄位 | 值 |
|---|---|
| dirname／命名空間 | `jill_deid`／`XoopsModules\Jill_deid\`（`class/`，PSR-4） |
| `min_xoops`／`min_php` | `2.7.4`／`8.3`（跟隨 TadTools） |
| 開發位置 | `E:\my_xoops274\www\modules\jill_deid\`，獨立 git repo |
| 前端 | 原生 JS（ES modules），無打包步驟，改完重新整理即生效。`npm`、Vite、TypeScript、vitest 都不使用 |
| 發布排除 | `docs/`、`tests/`、`tools/`、`CLAUDE.md`、`check.ps1` 以 `.gitattributes export-ignore` 排除，不放上正式站 |
| 授權 | 上游 MIT。`assets/THIRD_PARTY_NOTICES.txt` 須列 data-deidentification、pdf.js、pdf-lib、tesseract.js、jszip、libphonenumber-js、Noto Sans TC（OFL），後台關於頁連到此檔 |

PHP 相容要求：`declare(strict_types=1);`（`xoops_version.php`、語言檔除外）；屬性明確宣告；內建字串函式不收 `null`（`(string)($v ?? '')`）；禁 `"${var}"`、`$$key`、`utf8_encode`；參數一律 `Xmf\Request`；`NOT NULL` 欄位皆有 `DEFAULT` 或於寫入時給值。

---

## 2. 目錄結構

```text
modules/jill_deid/
├── xoops_version.php
├── header.php / footer.php / interface.php
├── index.php                 ← 前台，一般 XOOPS 流程（§6.1）
├── admin/{menu,main,header,footer,about}.php
├── class/
│   ├── Rule.php              ← CRUD、validate()（純函式，無 XOOPS 相依）、import_pack()
│   ├── Preset.php            ← CRUD、custom_config 驗證
│   ├── Config.php            ← 組前台設定 JSON（§7）
│   ├── Tools.php             ← 由 dinfo 精簡
│   └── Update.php
├── include/{rule_pack.json,categories.json}  ← 規則包（§6.4）與保留類別（上游 CATEGORIES＋網址），PHP 不寫死中文
├── preloads/{autoloader,core}.php
├── templates/
│   ├── jill_deid_index.tpl   ← 前台外框：h3 標題、分頁按鈕與使用說明連結（語言常數）、#jill-deid-app、設定 JSON
│   ├── jill_deid_admin.tpl
│   ├── sub_jill_deid_post.tpl ← 刪除／切換／匯入共用的 POST 表單＋SweetAlert 確認（§6.2）
│   └── op_jill_deid_{rule,preset}_{index,form}.tpl
├── assets/
│   ├── js/upstream/{core,formats,ui}/*.js   ← 上游去型別後的程式，含介面（§4）；修改逐條記入 PATCHES.md
│   ├── js/jill/              ← 本模組前端，見下
│   │   ├── main.js           ← 進入點：取代上游 main.ts，建立 #jill-deid-portal、掛載上游三個分頁
│   │   ├── admin-rule.js     ← 後台規則表單：保留方式 JSON、Worker 試跑與壓力測試（§3.3-6）
│   │   ├── columns.js        ← 欄首標籤偵測（§6.5，純函式）
│   │   └── assets.js、uri-scan.js、links/*、regex.worker.js（§3.3，前後台共用）
│   ├── vendor/               ← 第三方現成檔，勿手改；由用到的模組自行 import（§4），index.php 不載入
│   ├── css/upstream.css      ← 轉換工具由上游 styles.css 產生，限定在 app 與 portal 內，勿手改（§4）
│   ├── css/jill_deid.css     ← 只補佈景 Bootstrap 同名 class 改掉的屬性（§6.1），同樣限定範圍
│   ├── fonts/NotoSansTC-Regular.ttf、ocr/{worker.min.js,core/,lang/}、samples/
│   ├── .htaccess             ← 快取設定（§4）
│   └── THIRD_PARTY_NOTICES.txt
├── docs/{spec.md,PATCHES.md,VENDOR.md,marker-in-uri.md}
├── tools/{strip-upstream.mjs,check-har.php,e2e.mjs,browser-tests.mjs,make-h15.ps1}
├── tests/
│   ├── rule_validate_test.php   ← 純 assert，免 XOOPS、免 PHPUnit
│   ├── admin_db_test.php        ← 命令列載入本機 XOOPS，測 DB 往返、預設情境唯一、規則包、樣板渲染（§9.3），結束時清除
│   └── browser/                 ← 瀏覽器測試頁（§9.2）：index.html、runner.js、patches.test.js（§4 修補）、§9.2 向量、leak-check.js、fixtures/、upstream/
├── CLAUDE.md、check.ps1
├── language/{tchinese_utf8,english}/{modinfo,main,admin}.php（english SHOULD，至少 modinfo）
└── sql/mysql.sql
```

命名：`op` 為 `[entity]_[動作]`；常數 `_MI_JILLDEID_*`、`_MD_JILLDEID_*`、`_AM_JILLDEID_*`。

模組設定（`$modversion['config']`）：`url_personal_hosts`（textarea，一行一筆，預設值見 §5.2）；`column_labels`（textarea，一行一筆 `標籤=類別`，預設值見 §6.5）。其餘上限沿用上游常數，不開放設定。

---

## 3. 資料庫

### 3.1 `jill_deid_rule`

```sql
CREATE TABLE `jill_deid_rule` (
  `id` smallint unsigned NOT NULL AUTO_INCREMENT,
  `title` varchar(100) NOT NULL DEFAULT '',
  `category` varchar(10) NOT NULL DEFAULT '',
  `pattern` varchar(500) NOT NULL DEFAULT '' COMMENT 'JS RegExp source, flags fixed to gu',
  `apply_to_url` enum('1','0') NOT NULL DEFAULT '1',
  `retention` varchar(255) NOT NULL DEFAULT '{"mode":"none"}',
  `sample_text` varchar(255) NOT NULL DEFAULT '',
  `description` varchar(255) NOT NULL DEFAULT '',
  `locked` enum('1','0') NOT NULL DEFAULT '0',
  `enable` enum('1','0') NOT NULL DEFAULT '1',
  `sort` smallint unsigned NOT NULL DEFAULT 0,
  `uid` mediumint unsigned NOT NULL DEFAULT 0,
  `updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_enable_sort` (`enable`, `sort`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4;
```

### 3.2 `jill_deid_preset`

```sql
CREATE TABLE `jill_deid_preset` (
  `id` smallint unsigned NOT NULL AUTO_INCREMENT,
  `title` varchar(100) NOT NULL DEFAULT '',
  `description` varchar(255) NOT NULL DEFAULT '',
  `keep_strategy` enum('partial','hide_all','custom') NOT NULL DEFAULT 'partial',
  `marker_style` enum('code','label','blank') NOT NULL DEFAULT 'code',
  `hyperlink_mode` enum('mask_pii_in_url','strip_link') NOT NULL DEFAULT 'mask_pii_in_url',
  `custom_config` text NOT NULL,
  `is_default` enum('1','0') NOT NULL DEFAULT '0',
  `enable` enum('1','0') NOT NULL DEFAULT '1',
  `sort` smallint unsigned NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8mb4;
```

`is_default`：寫入後把其他列設為 0。萬一殘留多筆，`Config::build()` 取 `sort` 最小者，確保前端只收到一筆預設。

### 3.3 規則驗證

**輸入**：`pattern`、`custom_config`、`retention` MUST 以 `Request::getText(name, '', 'POST')` 讀取，**禁用 `getString`**（§B）。

**`$filter_arr`**：`pattern` 歸 `pass`（寫入只 escape，輸出時才跳脫）；`retention`、`custom_config` 歸 `json`；其他文字歸 `text`。

**`Rule::validate(array $data): array`** 回傳錯誤訊息陣列，不碰 `$xoopsDB`：

1. `pattern`：`mb_strlen` 1–500；不含換行、NUL。
2. 拒絕災難性回溯結構：巢狀量詞（`(a+)+`、`(\w*)*`、`(.*){2,}`、`(a+){5}`）、可重疊交替後接量詞（`(a|a)+`）、反向引用 `\1`、`\k<名稱>`。實作為掃描括號的黑名單（`Rule::riskyPattern()`）：群組內有長度可變的量詞，且群組本身再重複（含 `{n}`、n > 1），才算巢狀；內層固定寬度的 `(\d{3}-){2}` 放行；lookbehind 不算違規。黑名單不求完備，真正的保護是 Worker 逾時與表單壓力測試。
3. 空字串：`@preg_match('/' . str_replace('/', '\/', $p) . '/u', '')` 回傳 `1` 就拒絕；回傳 `false` 代表 PCRE 不支援該語法，不算錯，交給第 6 點。
4. `category`：`preg_match('/^[^\[\]:\s]{1,10}$/u', ...)`（**必須 `/u`**，否則以位元組計算，4 個中文字就超過），且不得與內建類別或保留字 `網址` 同名。
5. `retention`：通過 §3.4。

6. **後台表單 JS（輔助）**：沿用上游 `validateRegex`（`new RegExp(p,'gu')`、不可匹配空字串）；在 `regex.worker.js` 內以 `sample_text` 試跑，零命中拒絕送出；再以壓力字串（`sample_text` 重複 500 次、`'a'.repeat(5000)+'!'`、`'1'.repeat(5000)`、`' '.repeat(5000)`）各跑一次，任一超過 200 ms 拒絕送出（時間由 Worker 自己量；主執行緒 2 秒強制終止，視為過慢）。小樣本跑得快不代表大檔不會回溯失控，例如 `\d+\d+\d+\d+x` 能通過黑名單，但在 5,000 個 `1` 上會失控（`tests/browser/admin-rule.test.js`）。

**前台執行（MUST）**：整段偵測（內建＋機構＋個人規則）在**單一 module worker**（`assets/js/jill/regex.worker.js`，`new Worker(url, {type:'module'})`）執行，主執行緒不跑任何 regex。Worker 直接 import `core/patterns.js` 取得內建規則與 `validate`；主執行緒只送 `{text, builtinIds, extra:[{id,regex,category,retention}]}`，全文每份只送一次。流程：

1. Worker 依序跑每條規則，開始前送 `{start:id}`，跑完送 `{done:id, cands}`（尚未解重疊，由主執行緒與欄首候選一起 `resolveOverlaps`）。
2. 主執行緒看門狗：同一條規則 2 秒沒有 `done` 即 `terminate()`，記下該規則，重建 Worker 只跑尚未完成的規則；UI 警示「規則 X 逾時已略過」。**Worker 整頁共用一個**，只在看門狗終止時重建：每次新建都要重抓模組，`no-cache` 下斷網會失敗（Phase 3a e2e 實測）。無法啟動或重建時，剩下的規則一律記為略過（fail closed）。
3. **逾時即 fail closed**：該檔有被略過的規則時，下載前要求使用者確認「部分規則未執行，結果可能遺漏個資」（沿用上游的確認方式）。
4. 主執行緒以 `toItems(text, cands, book)` 產生項目並編碼（CodeBook 只在主執行緒）。§6.5 欄首候選與手動項目都在主執行緒併入，再做一次 `resolveOverlaps`。
5. 呼叫端在上游 `ui/process-view.js` 的兩個 `detect()` 呼叫點（§A），改為 async（§4 修補）。

**XSS**：後台 Smarty 輸出一律 `|escape`；前台一律 `textContent`。

### 3.4 Retention

```json
{ "mode": "none" }
{ "mode": "preview" }
{ "mode": "ends", "head": 2, "tail": 0 }
{ "mode": "delim", "delimiter": "@", "side": "after" }
{ "mode": "surname" }
{ "mode": "city" }
{ "mode": "district" }
```

PHP 以白名單驗證：`head`、`tail` 為 0–20 整數；`delimiter` 1–3 字；`side` 為 `before`／`after`；`surname` 僅限類別 `姓名`；`city`、`district` 僅限 `地址`。

**不新增 Retention mode**：`網址` 類別的「保留來源」放在 `standardSplit` 的 `case '網址'`（head＝`scheme://host[:port]/` 長度）。

**策略對照（MUST，Config 依此輸出，前端依此套用）**：

| `keep_strategy` | 上游 `OutputMode` | 內建類別 | 機構規則 |
|---|---|---|---|
| `hide_all` | `code` | 全隱藏 | 全隱藏 |
| `partial` | `preview` | `standardSplit` | 該規則的 `retention`（不走 `standardSplit`，否則預設露出第 1 字） |
| `custom` | `custom` | 畫面上的逐類別調整 ?? `custom_config[類別]` ?? 個人保留設定 ?? 全隱藏 | 畫面上的逐類別調整 ?? `custom_config[類別]` ?? 規則 `retention` ?? 全隱藏 |

`custom_config` 格式 `{ "<類別>": <Retention> }`，載入時存在 `state.presetCustom`（記憶體），**不寫 localStorage**。「個人保留設定」即上游 `custom` 模式的 `it.retention`（規則頁 `setRetention`、`setCategoryRetention` 存於 localStorage），與上游一致。

**「設為預設」（§6.1 去識別化頁第 7 項）只存使用者在畫面上逐類別調整過的類別**（`state.overrides`），寫入個人保留設定；情境帶入的 `custom_config` 值不寫入，避免切換情境後殘留在個人設定裡。

---

## 4. 上游移植方式

**只取用** `src/core/`、`src/formats/`、`src/ui/`、`src/styles.css`、`tests/`、`public/fonts/`、`public/samples/`、`LICENSE`。不要帶入 `src/main.ts`、`.claude/`、`.specify/`、`docs/`、`examples/`、`index.html`、SEO 檔、`llms*`、`og.png`。

**分工（MUST，v3.7）**：上游 `core/`、`formats/`、`ui/` 原樣沿用，介面、流程、狀態、範例都用上游的。本模組只負責：
- 轉換時的佈景相容調整（見下方轉換第 4 點）；
- `jill/main.js` 取代 `main.ts`，掛載三個分頁；
- `assets/css/jill_deid.css` 處理 Bootstrap 同名 class；
- 後台與 PHP 設定；
- 下表核准的修補，包含本模組新增的功能。

**一次性轉換**（`tools/strip-upstream.mjs`，執行者用現有的 Node 22.13 以上跑一次；結果提交進 repo，之後不再需要 Node）：

1. 以 `node:module` 的 `stripTypeScriptTypes(src, {mode:'strip'})` 轉 `src/core/`、`src/formats/`、`src/ui/` 下的 `.ts`（不含 `main.ts`）。上游沒有 `enum`、`namespace` 或建構子參數屬性，去型別不改語意（已實測：全部成功，語法檢查 0 失敗）。
2. 相對 import 補 `.js`，目錄 import 補 `/index.js`；套件 import 依下表改寫。**不用 import map**：全部改寫成相對路徑，免得依賴頁面上的行內 script，日後要恢復 CSP 也不必改。
3. **第一個 commit 只放未修改的轉換結果**，之後 `git diff` 才看得出對上游的修改。
4. **佈景相容調整（v3.7，機械式，跟進上游時自動重做）**：
   - `ui/` 的 `el('h2'`、`el('h3'` 降為 `h4`、`h5`。前台頁面標題是樣板的 `<h3>`，分頁內容從 `<h4>` 起。
   - `ui/` 中 `document.body.append(`、`*.ownerDocument.body.append(` 改為掛到 `#jill-deid-portal`，找不到時退回 `body`。portal 由 `jill/main.js` 建立，是 body 的直接子元素，定位方式與掛在 body 上相同。
   - `src/styles.css` 轉成 `assets/css/upstream.css`。每條規則（含 `@media` 內）前面加上 `:is(#jill-deid-app, #jill-deid-portal)`；`:root`、`html`、`body` 換成這個範圍本身；`@keyframes` 不動；選擇器中的 `h2`、`h3` 同步降級。上游的 `:root { font-size: 15px }` 因此不再改動佈景的 `rem` 基準。字型清單拿掉 `'Noto Sans TC'`：佈景從 Google Fonts 以 unicode-range 切片載入同名字型，上游一指名，瀏覽器就會依文件裡出現的字去抓對應分片。Phase 1b 實測選檔後出現 7 個 `fonts.gstatic.com` 請求，等於洩漏文件含哪些字，違反 INV-1 (c)；改用系統字型。
   - `ui/` 中呼叫原生 `confirm(` 的行尾加上 `// xoops-lint-ignore`。這 3 處是瀏覽器內的本機確認（刪除個人規則、移除未下載的檔案、全部清除），不是伺服器端刪除，沿用上游作法（§6.1）。

| 上游 | 本模組 |
|---|---|
| `jszip` | `assets/vendor/jszip.min.js`（UMD），改為 `import '<相對路徑>/vendor/jszip.min.js'; const JSZip = globalThis.JSZip;` |
| `@pdf-lib/fontkit` | `fontkit.umd.min.js`（UMD），同上改為 `globalThis.fontkit` |
| `libphonenumber-js` | `libphonenumber-min.js`（UMD），同上改為 `globalThis.libphonenumber` |
| `pdf-lib` | `pdf-lib.esm.min.js`，相對路徑 import |
| `pdfjs-dist`、`?url` worker | `pdf.min.js`、`pdf.worker.min.js`（來源 `.mjs` 存檔時改副檔名，避免 Apache 回錯 MIME）；worker 路徑由 `assetsBase` 組成 |
| `tesseract.js`（動態 import） | `tesseract.esm.min.js`；OCR 的 worker、core、語言檔放 `assets/ocr/`，檔名同上游 `OCR_ASSETS` |
| `import.meta.env.BASE_URL` | `jill/assets.js` 的 `assetsBase`（由該檔自身網址推得 `assets/` 位置） |

已於 Phase 1b 實跑確認：`JSZip`、`fontkit`、`libphonenumber` 三個全域變數存在；`tesseract.esm.min.js` 有 default export。

**UMD 以 side-effect import 載入（v3.6）**：三個 UMD 在 module 內 `this` 為 `undefined`，會改掛到 `window`／`self`／`globalThis`，頁面與 module worker 皆可用；import 在模組本體前依序求值，所以下一行即可取用全域變數。好處：fontkit（758 KB）只在 PDF 輸出時載入；Worker 可直接 import `core/patterns.js`（§3.3）；`index.php` 不必 `addScript`。前提是頁面沒有 AMD `define`（有的話 UMD 會改向 AMD 註冊）。

**第三方檔案**：版本以上游 `package-lock.json` 為準，由 npm registry 或 unpkg 下載一次。`docs/VENDOR.md` 記錄每個檔案的來源網址、版本與 SHA-256。

**快取**：沒有打包就沒有帶 hash 的檔名，`?v=` 也傳不到子模組。`assets/.htaccess` 在 `<IfModule mod_headers.c>` 內對 `js/`、`vendor/`、`css/` 設 `Cache-Control: no-cache`，讓瀏覽器每次驗證 ETag，升級後才不會混用新舊模組。pdf.js 每份文件會重建一次 worker 並重新抓 `pdf.worker.min.js`（1.4 MB），在 `no-cache` 下斷網可能失敗，§9.1 斷網項目須含「同一頁處理第二份 PDF」；Phase 1b 實測確實失敗（`Failed to fetch dynamically imported module … pdf.worker.min.js`），已改為共用單一 worker（P1-1）。

**跟進上游**：不做自動合併。把新版轉到暫存目錄，與前一版轉換結果比對，再手動套入 `assets/js/upstream/`。

上游檔案不可能完全不改。**下列為核准的修改點**（路徑相對於 `assets/js/upstream/`），`docs/PATCHES.md` 逐條記錄；清單外的修改要先提問：

| 檔案 | 修改 |
|---|---|
| `formats/pdf.js`、`formats/ocr.js` | 改用 `jill/assets.js` 的 `assetsBase`（轉換工具已處理）；`ocr.js` 關閉 Tesseract 的 stderr 輸出，避免 console 錯誤訊息（§9.1）；**（P1-1，Phase 1b 實測）**`pdf.js` 改為整頁共用單一 worker（`GlobalWorkerOptions.workerPort`）：原本每份文件重抓 `pdf.worker.min.js`，斷網後第二份 PDF 失敗 |
| `core/types.js` | `CATEGORIES` 可於執行期加入機構類別、§6.5 標籤類別與 `網址`；`LoadedDocument` 增加選用的 `links`（`LinkTarget[]`）。型別宣告已隨去型別移除，新程式以 JSDoc 標註 |
| `core/retention.js` | `standardSplit` 增加 `case '網址'` |
| `core/patterns.js` | 新增 `url` 規則（§5.2） |
| `core/pattern-store.js` | `STORAGE_KEY` 改 `jill_deid.patternConfig.v1`；`getEffectivePatterns` 併入機構規則 |
| `core/detector.js` | **（P0，Phase 1b）** export `resolveOverlaps` 並改為 O(n log n)：已選區間依 `start` 排序，二分搜尋插入點只比左右鄰居，結果與原版相同；（Phase 3a）拆出 `findCandidates(text, patterns)`（Worker 用，回傳已解重疊的候選）與 `toItems(text, cands, book)`，`detect` 保留為兩者組合 |
| `core/restorer.js` | 增加 URI 位置還原（§5.3） |
| `formats/index.js` | `generateDocument(doc, edits, linkEdits = [])` |
| `formats/docx.js` | **（P0，Phase 1b）** 解析時把 part 起點 offset 存進 part，輸出時沿用，不再以第一個 `<w:t>` 推算（§A）；其餘依 §5.5 擴充 |
| `formats/xlsx.js` | **（P0，Phase 1b）** 數值儲存格（無 `t` 或 `t="n"`，且沒有 `<f>`）納入文字；只有被改到的格子轉成 inlineStr，其餘不動；其餘依 §5.5 擴充 |
| `formats/pdf.js`、`plaintext.js` | 依 §5.5 擴充 |
| `ui/process-view.js` | 情境下拉與策略對照（§3.4）、超連結處理與 `🔗`（§5.4、§6.1）、偵測改走 Worker 並 async（§3.3）、欄首候選（§6.5）與來源標示、逾時下載確認、跨檔案共用與規則合併機構規則 |
| `ui/patterns-view.js` | 機構共用規則分組（唯讀，非 locked 可停用）、測試網址框 |
| `ui/restore-view.js` | 接上 URI 位置還原（§5.3） |

本模組新增的功能（情境、超連結模式、`🔗`、機構規則分組、Worker 偵測、策略對照、欄首候選、逾時確認）都以修補方式加在上游 `ui/`，依上表逐條記錄於 `docs/PATCHES.md`。

**i18n（v3.7）**：上游 `core/`、`formats/`、`ui/` 的中文原樣沿用；本模組在這些檔案內的修補，比照該檔使用中文。`assets/js/jill/`、樣板、PHP 不得硬寫中文：樣板用語言常數；`jill/` 需要的動態訊息由 `Config` 的 `i18n` 傳入。上游介面為中文，英文語系只涵蓋樣板與後台。

---

## 5. 核心擴充：超連結雙層去識別化

### 5.1 URI 位置與資料流

**資料模型**（`assets/js/jill/uri-scan.js`，純函式，先寫測試；以下為資料形狀，實作以 JSDoc 標註）：

```ts
interface LinkTarget {
  id: string;
  uri: string;
  part: string;                            // zip 內路徑，或 'text'、'pdf:<page>'
  kind: 'rels' | 'field' | 'fldSimple' | 'xlsx-formula' | 'md' | 'pdf';
  displayRange?: [number, number];         // 對應 text 的顯示文字範圍，沒有就列在文件連結清單
  writable: boolean;                       // pdf 為 false：只偵測與提示
}
interface LinkHit { code: string; category: string; original: string; prefix?: string; suffix?: string } // 即 CSV 一列
interface LinkDecision {
  action: 'rewrite' | 'strip' | 'keep'; uri?: string; hits: LinkHit[];
  warnings: ('undecodable' | 'host' | 'marker')[];  // 代碼，介面文字由 ui/ 修補提供（§4 i18n）
  unrestorable: boolean;
}
function scanUri(uri: string, patterns: Pattern[], book: CodeBook,
  opts?: { retentionOf?(cand): Retention | undefined; hyperlinkMode?: string; markerStyle?: string }): LinkDecision;
function restoreUri(uri: string, mapping: MappingEntry[]): { uri: string; missingCodes: string[]; restoredCount: number };
```

`linkId` 由格式寫回端（3b-2 起）自行對應，`scanUri` 只處理單一 URI。細節與文字層例外見 `docs/marker-in-uri.md`（v3.8，Phase 3b-1 建立）。

格式解析器填 `links`；`formats/index.js` 的 `generateDocument` 收到 `LinkDecision[]` 後交給各格式寫回。URI 內的命中也要進 CSV，與內文共用同一個 `CodeBook`。

**掃描字串（MUST）**，用整段文字會讓個資被標到結構字元，只掃組件又會讓 lookbehind 規則失效，所以依下表：

| 組件 | 掃描字串 | 命中後 |
|---|---|---|
| scheme | 不掃 | |
| userinfo | 解碼後整段 | 替換該段 |
| host（含 IP） | 解碼後整段 | host 放不下標記，該連結一律 `strip`，UI 標示「連結不可還原」 |
| path 每段 | 解碼後單段 | 只替換命中區段，該段重新編碼 |
| query | 每組 `<?或&>key=value`，**保留前綴與 key 作為上下文**（`(?<=[?&]sid=)` 才命中得到） | 命中必須與 value 有交集才算；只替換 value 內區段，key 不動 |
| fragment | 解碼後整段 | 同 path |
| `mailto:` | 收件者以 `,` 切開逐一掃；`?cc=`、`bcc=`、`subject=`、`body=` 比照 query | 重新編碼時保留 `@` |
| `tel:` | 冒號後整段 | 重新編碼時保留 `+`、`-` |

- query 的 `+` 視為空白。未命中的組件**不重新編碼**，保持原位元組。
- 只掃啟用且 `applyToUrl !== false` 的規則，內建規則皆為 `true`。
- **解碼失敗（`URIError`，例如 Big5 的 `%A4%FD`）**：校務舊系統常見，無法判斷內容。整個組件值視為命中，以類別 `網址` 全遮蔽並於 UI 警示，不得放行（fail closed）。

### 5.2 內建規則 `url`（第 16 條）

- `id:'url'`、類別 `網址`、`group:'intl'`、`preview` 時保留來源（H10）。
- 比對 `https?://…`、`www.…`；以 `validate` 比對個人頁清單（`Config.urlPersonalHosts`），**只有命中清單才整條成為候選**。清單外的網址只做 §5.1 掃描。
- 清單項目格式 `domain[/pathPrefix]`，domain 以尾端比對（`www.`、`m.` 等子網域皆算），pathPrefix 以路徑開頭比對。
- 預設值：`facebook.com`、`fb.com`、`instagram.com`、`threads.com`、`threads.net`、`line.me/ti/p`、`linkedin.com/in`、`drive.google.com`、`docs.google.com`、`onedrive.live.com`、`1drv.ms`、`dropbox.com`。

### 5.3 標記寫法與還原（`docs/marker-in-uri.md`，隨 Phase 3b 建立）

**寫入**：URI 內的標記為 `encodeURIComponent('[類別:code]')`，例如 `%5B%E8%BA%AB%E5%88%86%E8%AD%89%3A7b21e8%5D`。

**文字層裸網址例外**：顯示在 `text` 裡的裸網址屬文字位置，直接寫未編碼的 `[類別:code]`，由上游流程還原。命中落在 percent-encoded 區段時，`original` 取 `text.slice` 的原始編碼字串，retention 強制 `none`，以保留 offset 正確性與位元組還原。

**CSV**：

| 類別 | `original`、前後綴存放 | 還原寫回 |
|---|---|---|
| 一般類別 | 解碼後的值 | `encodeURIComponent(original)` |
| `網址` | URI 原始字串（可含 `/`、`?`） | **原樣，不編碼**，否則 `/` 變 `%2F` |

**還原演算法（不拆組件）**：直接對 URI 字串執行：

```ts
/%5B((?:(?!%5B|%5D|%3A).){1,90}?)%3A([0-9a-f]{6})%5D/gi
```

每個命中依上表替換，其餘位元組不動；查無編碼則保留並列入 `missingCodes`。

**還原一致性定義**：還原後 URI 與原 URI 經 `decodeURIComponent` 正規化後相同，只有被隱藏區段的編碼大小寫、`+` 與 `%20` 可能不同。

### 5.4 處理模式

| `hyperlink_mode` | 顯示文字 | URI | 可還原 |
|---|---|---|---|
| `mask_pii_in_url`（預設） | 正常偵測替換 | §5.1 只改命中處 | 標記為 `code` 時可還原；host 命中者除外 |
| `strip_link` | 正常偵測替換 | 含個資者移除連結結構，只留文字 | 文字可還原，**連結不可還原**，UI 要標示 |

- `marker_style` 為 `label`、`blank` 時，URI 放不下可還原標記，MUST 強制 `strip_link` 並提示原因。
- 未命中的連結原樣保留。使用者可對單一連結選「取消去識別化」或「移除連結」。

### 5.5 各格式零殘留清單

**DOCX**

1. 走訪 zip 內**所有** `*.rels`，凡 `TargetMode="External"` 的 `Target` 都掃描改寫。這一條涵蓋 document、頁首尾、註腳、圖形（`a:hlinkClick`）與外部圖片，不要逐一列舉 part。
2. `<w:hyperlink r:id>` 對應顯示文字。同一 rId 被多處引用且決定不同時，複製新 rId（H7）。
3. 欄位碼：`<w:instrText>` 的 `HYPERLINK "…"`，**可能被拆成多個 run**。自 `fldChar begin` 到 `separate` 串接後解析，寫回第一個 `instrText`，其餘清空。`<w:fldSimple w:instr>` 同樣處理。
4. `w:tooltip` 屬性走一般偵測。
5. 文字掃描範圍增加 `footnotes.xml`、`endnotes.xml`、`comments.xml`。
6. **上游殘留修補（MUST）**：輸出時移除 `mc:Fallback`、`w:del`、`w:moveFrom` 節點；清空 `w:ins`、`w:del`、`w:comment` 的 `w:author`、`w:initials`。否則文字方塊與追蹤修訂的原文會留在檔案裡。
7. `docProps/core.xml`、`app.xml`、`custom.xml` 的作者、最後修改者、公司 MUST 清空（預設開啟，UI 可關）。
8. **`word/people.xml`（v3.6，H15 實測）**：修訂者名單，MUST 與第 6 點同步處理：清空 `w15:person` 的 `w15:author`，移除 `w15:presenceInfo`（登入 Office 時含帳號 ID，可能是 email）。

實作補充（v3.8，Phase 3b-3，`jill/links/docx.js`）：
- 一個連結＝一處引用：同一 rId 被引用幾次就有幾個連結，可各自決定。沒有引用的外部關係（例如套件層 `_rels/.rels`）算一個連結。
- `strip`：`w:hyperlink` 保留文字、去掉外框；`a:hlinkClick`／`a:hlinkHover` 移除；其他引用移除該屬性；關係本身刪除。欄位碼刪除 begin、指令、separate、end 所在的 run，保留顯示結果；`fldSimple` 去掉外框。
- 第 6 點擴大為清空所有元素的 `w:author`、`w:initials`（含 `w:rPrChange` 等格式修訂）。`custom.xml` 的屬性名稱任意，所有值一律清空（fail closed）。
- 每次下載先還原 rels 等原始 XML，重複下載結果一致。
- 第 7 點「UI 可關」的開關延到 4a；在那之前一律清空。
- Word 實際開檔以 `tools/office-open.ps1` 驗證（不修復、不跳對話框），e2e 對 `fixtures/links.docx`（`tools/make-links-docx.ps1` 以 Word 產生）每次執行。

**XLSX**

1. `xl/worksheets/sheetN.xml` 的 `<hyperlink>`：`display`、`tooltip`、`location` 走一般偵測，`r:id` 目標由上述 `*.rels` 規則處理。
2. 公式 `<f>HYPERLINK("url","text")</f>`：解析字串參數改寫，**同步改 `t="str"` 的 `<v>`**。上游不讀這類儲存格，要新增。不可沿用 `setInlineString`，它會刪除 `<f>`。
3. 註解 `xl/comments*.xml`、`xl/threadedComments/*`：SHOULD。
4. `docProps/*` 同 DOCX。

實作補充（v3.8，Phase 3b-4，`jill/links/xlsx.js`；rels 與 DOCX 共用 `jill/links/rels.js`）：
- 無 `r:id` 的 `<hyperlink location>`（活頁簿內部連結）同樣掃描 `display`、`tooltip`、`location`。Excel 會把網址本身寫進 `display`，所以這些文字也要掃網址內的編碼片段（`detectShort`）。
- `HYPERLINK()` 只處理網址為字串常值的公式（名稱可為常值或參照）；`""` 視為 `"`。`strip` 時該格改成 inlineStr，只留顯示文字（已去識別化），`<f>` 移除。
- 有公式被移除時刪除 `xl/calcChain.xml`，連同 `workbook.xml.rels` 的關係與 `[Content_Types].xml` 的 Override。否則 Excel 判定檔案損毀；calcChain 只是快取，Excel 開檔時會重建。
- 第 3 點註解：`comments*.xml` 的 `<author>` 清空但保留元素（`authorId` 仍指得到）；`xl/persons/*.xml` 清空 `displayName`、`userId`（登入帳號，可能是 email）。
- Excel 實際開檔以 `tools/office-open.ps1` 驗證，e2e 對 `fixtures/links.xlsx`（`tools/make-links-xlsx.ps1` 以 Excel 產生）每次執行。站上預設情境是 `strip_link`，所以「改寫網址」的路徑另由 `docx.test.js`、`xlsx.test.js` 以同一份 Office 範例檔驗證零殘留。

**PDF**：輸出重建已滿足 INV-2。新增以 `page.getAnnotations()` 讀 `Link` 的 `url`、`rect`，`writable:false`，UI 顯示「此頁有含個資的連結，輸出時連結會移除」。輸出與還原都不重建連結。

實作補充（v3.8，Phase 3b-5）：讀 `unsafeUrl`（原始目標；`url` 是 pdf.js 清理過的版本，非 http 的會是空值）。所有 PDF 連結的決定都是 `strip`；`scanUri` 有命中或有警示者另帶 `pdf` 警示，供 4a 顯示。H14 在瀏覽器以 pdf-lib 解碼輸出檔的所有物件檢查（等同 `qpdf --qdf` 展開；本機未安裝 qpdf）。

**還原核心**（`assets/js/jill/links/restore.js`，Phase 3b-5）：`restoreDocument(doc, mapping)` 對解析後的去識別化檔：
- 內文標記交給上游 `restore()`。
- Markdown／TXT 的連結網址以 `restoreUri` 還原。
- DOCX／XLSX 的 `doc.links`：目標以 `restoreUri` 還原，tooltip、display、公式名稱與 `<v>` 以 `restore()` 還原。

產出的 `edits`、`links` 交給 `generateDocument`，寫回端與去識別化共用。還原頁（`ui/restore-view.js`）接上它屬 4c。

**Markdown／貼上文字**（`assets/js/jill/links/markdown.js`）：辨識 `[text](url "title")`、`![alt](url)`、`<https://…>`、`<mailto:…>`、`[id]: url "title"`、`<a href="…">`、裸網址。

- `text`、`alt`、`title` 走一般偵測；`url` 範圍走 §5.1，並**從一般偵測排除**，以免同一處被改兩次。
- 程式碼區塊內仍要掃描。
- （v3.8，3b-2 實作）`<https://…>`、`<mailto:…>` 與裸網址**顯示在文字中**，屬 §5.3 文字層，照一般偵測處理，不走 §5.1；只有不顯示的網址（inline 的 `(url)`、定義 `[id]: url`、`href`／`src` 屬性值）是 URI 位置。
- `strip` 時：inline 連結與圖片只留文字或 alt，定義整行移除，HTML 屬性值清空；被移除部分內的文字編輯一併捨棄。
- 使用者手動新增的項目落在網址內時，該連結改為 `strip`（警示 `manual`），不與改寫衝突。
- 每個輸出出口（下載文件、編碼表、複製、合併編碼表、打包）都經 `process-view` 的 `redact()`，以同一組設定改寫（PATCHES P1-6）。

**TXT**：貼上的文字以 `.txt` 處理，所以 TXT 同樣辨識上列連結語法；其餘只有裸網址與 `mailto:`、`tel:`（文字層）。

---

## 6. 功能

### 6.1 前台 `index.php`：一般 XOOPS 流程，套佈景

**決定**（2026-11-10 使用者修訂，取代原獨立頁方案）：前台與其他模組一致，走 `header.php`／`footer.php`、套佈景，不送 CSP。

**Google 翻譯（v3.7）**：佈景的翻譯小工具會把整頁（含預覽中的個資）送到 Google。`index.php` 在佈景設定指派的樣板變數中拿掉 `google_translate` 項目，本頁不輸出小工具、也不載入它的 script；`#jill-deid-app` 與 `#jill-deid-portal` 另加 `translate="no"`、`notranslate`，瀏覽器內建翻譯也略過。

**代價（MUST 知悉）**：佈景與區塊的 JS 和文件內容同源，可讀取預覽內容；佈景有行內腳本，無法套嚴格 CSP。零外傳（INV-1）因此只能以 §9.1 HAR 實測把關，佈景或區塊有變動時須重跑。

```php
<?php
declare(strict_types=1);
use XoopsModules\Jill_deid\Config;

require_once __DIR__ . '/header.php';
header('Referrer-Policy: no-referrer');          // 須在 XOOPS header.php 輸出前送出

$GLOBALS['xoopsOption']['template_main'] = 'jill_deid_index.tpl';
require_once XOOPS_ROOT_PATH . '/header.php';

$xoopsTpl->assign('deid_config_json', Config::toJson());
$xoTheme->addStylesheet('modules/jill_deid/assets/css/upstream.css');   // 轉換工具產生（§4）
$xoTheme->addStylesheet('modules/jill_deid/assets/css/jill_deid.css');  // Bootstrap 同名 class 相容
// vendor 由用到的模組自行 import（§4），這裡不載入
$xoTheme->addScript('modules/jill_deid/assets/js/jill/main.js', ['type' => 'module']);

require_once XOOPS_ROOT_PATH . '/footer.php';
```

#### 介面寫法（MUST）

- **沿用上游介面（v3.7）**：`jill/main.js` 取代上游 `main.ts`，不含頁首、作者連結與 FAQ。它負責：
  - 建立 `#jill-deid-portal`；
  - 依樣板的分頁按鈕掛載上游三個分頁，切換邏輯與 `main.ts` 相同；
  - 安裝 tooltip 與離開頁面前的提醒。
- **結構在樣板**：`jill_deid_index.tpl` 放 `<h3>` 頁面標題、分頁按鈕、「使用說明」連結（連到上游 README「操作流程」，新分頁開啟）與 `#jill-deid-app`，文字都用 `_MD_JILLDEID_*`。設定 JSON 於 Phase 2 加入。
- **標題層級**：上游的 `h2`、`h3` 由轉換工具降為 `h4`、`h5`（§4），分頁內不得出現 `h1`–`h3`。
- **樣式**：
  - `assets/css/upstream.css` 由轉換工具產生，不得手改。
  - `assets/css/jill_deid.css` 只補佈景 Bootstrap 同名 class 改掉、上游又沒有設定的屬性。目前有四處：`[hidden]`、`.toast`（Bootstrap 的 `:not(.show)` 會隱藏）、`.tooltip`（透明度 0）、`.mark`（文字顏色）。
  - 兩個檔案的每條規則都限定在 `:is(#jill-deid-app, #jill-deid-portal)` 內（`tests/browser/ui.test.js`）。
- **確認對話框與提示**：沿用上游的作法，包括 3 處原生 `confirm()`、上游的提示 dialog 與 toast。
- **`innerHTML`**：上游 `ui/` 沒有使用；`assets/js/jill/` 與樣板禁用。

#### 上游功能（沿用，對應上游 README「操作流程」步驟 1–7，驗收時逐項確認）

**去識別化頁**

1. 選檔與拖放（`ACCEPT_ATTR`、`MAX_FILES`、`MAX_FILE_BYTES`），可一次多檔、可「加入檔案」追加。
2. 貼上文字，按「開始去識別化」以純文字處理。
3. 範例卡：載入或下載 `assets/samples/` 的範例（沿用上游清單與檔案）。
4. 掃描 PDF 的 OCR：進度（頁數、縮圖）與「取消辨識」。
5. 每個檔案一張卡：偵測項目清單（類別、原值、預覽標記），可逐項取消，或依類別批次取消；類別統計；「重新偵測」；「移除」。
6. 預覽：標記位置以底色顯示，可切「純文字檢視」；在預覽中圈選文字可「新增為去識別化項目」。
7. 輸出設定：保留方式（全部隱藏／部分保留／自訂，自訂可逐類別設定並「設為預設」，優先順序與「設為預設」的範圍見 §3.4）、標記樣式（`code`／`label`／`blank`）。
8. 進階「跨檔案共用編碼」：整批共用 CodeBook；可匯入既有編碼表沿用，並輸出合併編碼表。
9. 下載：去識別化檔、編碼表 CSV；多檔時可打包下載；可複製純文字結果。有規則逾時被略過的檔案，下載前須確認（§3.3）。
10. 有未下載結果時，離開頁面前警示（`beforeunload`）。
11. 顯示各格式限制（`formatLimitations`）。

**偵測規則頁**

1. 內建規則依群組列出，可逐條或全部啟用／停用。
2. 個人自訂規則：新增、編輯、刪除（名稱、類別、RegExp、測試文字），以 `validateRegex` 驗證，可「填入範例」。
3. 每條規則可檢視並設定保留方式（`setRetention`、`setCategoryRetention`）。
4. 設定只存 `localStorage`（`pattern-store`）。

**還原頁**

1. 上傳去識別化文件與編碼表 CSV（可用範例體驗）。
2. 還原預覽，列出找不到的編碼（`missingCodes`）。
3. 下載還原文件。

#### 本模組新增

1. 頂部情境下拉，預設 `isDefault`。切換只重算保留方式（`resplitItems`），不重新解析檔案。
2. 輸出設定新增「超連結處理」（§5.4）。
3. 含個資連結旁的 `🔗` `<button>`（`aria-label` 用語言常數）：彈出層（Bootstrap popover／modal）對照顯示文字與連結的前後差異，可取消或移除連結；鍵盤可開啟、`Esc` 關閉。沒有 `displayRange` 的連結列在檔案上方的「文件連結」清單。
4. 偵測規則頁新增「機構共用規則」分組（唯讀，非 locked 可停用）與「測試網址」框（顯示解碼組件與命中位置）。
5. 範例 `samples/hyperlinks.{docx,xlsx,md}`，虛構資料，由腳本產生。
6. 介面明示已知不涵蓋範圍（§10）。
7. 偵測項目標示來源：規則命中、欄首標籤（§6.5，顯示標籤名）、手動。欄首候選可依欄批次取消。

**Phase 4a 實作與驗收（v3.8）**
- 第 3 項的 `🔗` 只插在 Word、TXT、Markdown 的預覽中，位置在連結顯示文字之後。
  - Excel 切換工作表、PDF 重繪頁面都由 `preview.js` 自行處理，會把按鈕洗掉，所以這兩種與沒有顯示文字的連結一律列在「文件連結」。
  - `aria-label` 依 §4 i18n（v3.7：`ui/` 修補比照上游用中文）寫在修補中，不另設語言常數。
- 「文件屬性」開關即 §5.5 DOCX 7 的「UI 可關」，預設勾選（清除）。

上游功能逐項驗收對照：

| 功能 | 驗證方式 |
|---|---|
| 1 選檔、多檔、加入檔案 | e2e、`process-ui.html` |
| 拖放 | 手動 |
| 2 貼上文字 | `presets.html` |
| 3 範例卡 | `ui.test.js` |
| 4 OCR | e2e |
| OCR 的「取消辨識」 | 手動 |
| 5 逐項取消、類別批次、重新偵測 | `process-ui.html` |
| 移除檔案 | e2e |
| 6 純文字檢視、圈選新增 | `process-ui.html` |
| 7 輸出設定 | `presets.html`、`process-ui.html` |
| 8 跨檔案共用編碼 | `process-ui.html` |
| 9 下載文件、編碼表、打包 | `process-ui.html`、e2e |
| 逾時確認 | `phase3a.test.js` |
| 10 離開警示（`hasUnsavedResults`） | `process-ui.html` |
| 11 格式限制 | `process-ui.html` |

### 6.2 後台 `admin/main.php`

| op | 方法 | 方式 |
|---|---|---|
| `rule_index`（預設）、`preset_index` | `::index()` | GET |
| `rule_create`、`rule_edit`、`preset_*` 同 | `::create(?int $id)` | GET，表單含即時測試 |
| `rule_store`、`rule_update`、`preset_*` 同 | `::store()`、`::update(int $id)` | POST＋token |
| `rule_destroy`、`rule_toggle`、`preset_*` 同 | `::destroy(int $id)`、`::toggle(int $id)` | POST＋token |
| `rule_import_pack` | `Rule::import_pack()` | POST＋token，同 `title` 略過 |

寫入型 op 開頭順序 MUST 為：`Request::getMethod()==='POST'` → `Utility::xoops_security_check()` → `$xoopsUser->isAdmin($xoopsModule->mid())`；結尾 `header('Location: …'); exit;`。

**刪除與切換**：**不使用 `SweetAlert::render()`**（§B，只能 GET）。本條覆蓋 convention 的 `$sa->render()` 寫法。作法：

```php
$xoTheme->addStylesheet('modules/tadtools/sweet-alert/sweet-alert.css');
$xoTheme->addScript('modules/tadtools/sweet-alert/sweet-alert.js');
```

列表頁放隱藏的 POST 表單（含 token），由 `swal({...}, function(){ form.submit(); })` 送出。

### 6.3 權限

- 前台由核心的 `module_read` 控管，`xoops_version.php` 不必另外實作。
- 管理權限不以 `$_SESSION` 作為判斷依據，每個寫入 op 都以 `isAdmin(mid)` 檢查。

### 6.4 校務資料涵蓋範圍

| 資料 | 處理方式 | 類別 |
|---|---|---|
| 身分證號 | 內建 `tw-id`（含檢核碼） | `身分證` |
| 姓名 | 內建 `zh-name` | `姓名` |
| EMAIL | 內建 `email` | `電子郵件` |
| 學號、座號、員編、文號 | 下方規則包，由後台匯入 | 同左 |

內建三類**不得**在規則包重建，§3.3 也會拒絕同名類別，否則同一值會出現兩種類別與編碼。

**規則包**（格式由使用者提供，2026-11-06）

| 資料 | 格式 |
|---|---|
| 學號 | 國小 6 碼、國中 7 碼，前 3 碼為入學學年度（115 學年度為 `115XXX`） |
| 座號 | 2 碼數字；國小常寫 1 碼（「座號 3」），規則收 1–2 碼（v3.6） |
| 員編 | 第 1 碼為英文大寫字母（不限 A），範例 `A200038`；其後 6 碼數字依此範例推定 |
| 文號 | 固定 10 碼數字。範例 `教課（一）字第1141431254號`、`字第1140087197A號`；結尾字母依範例推定為可省略的 1 個大寫字母 |

學號、座號是純數字，沒有固定前綴，一定要有標籤上下文，否則 `1\d{5,6}` 會把金額 `150000` 也遮掉。員編、文號有自己的特徵，不需要標籤。標籤在欄首、值在下方各列的名冊由 §6.5 處理。

| title | category | pattern | retention | sample_text |
|---|---|---|---|---|
| 學號 | 學號 | `(?<=學號[:：\s]*)1\d{5,6}(?!\d)` | `ends 3/0` | 學號 115001 |
| 座號 | 座號 | `(?<=座號[:：\s]*)\d{1,2}(?!\d)` | `none` | 座號 3 |
| 教職員編號 | 員編 | `(?<![A-Za-z0-9])[A-Z]\d{6}(?!\d)` | `none` | 員編 A200038 |
| 公文字號 | 文號 | `(?<=字第)\d{10}[A-Z]?(?=號)` | `none` | 教課（一）字第1140087197A號 |
| 校務網址參數 | 學號 | `(?<=[?&](?:stu\|sid\|student_id)=)[^&#\s]+` | `none` | `?sid=112001` |

規則也會跑在內文上。v3.5 的 `[^&#]+` 不排除空白與換行，實測在內文中從 `112001` 一路吞到文件結尾；v3.6 加上 `\s`。

### 6.5 欄首標籤偵測（v3.6）

**理由**：學校最常處理的是名冊。實測 v3.5 的流程中：學號、座號在 Excel 多為數值格，原本完全不讀（§A，已修補）；標籤在欄首時，§6.4 的前後文規則不會命中；表外姓氏（武、章、尹、崔、史、熊）在姓名欄 6 個全漏。

**範圍**：XLSX（`layout.sheets[].cells`）與 DOCX 表格（`layout.paragraphs[].table`，同一格多段落合併為一格）。TXT、MD、PDF 不做。

**`assets/js/jill/columns.js`**（純函式，先寫測試）：`columnCandidates(doc, labels) → {category, start, end, label}[]`

1. 標籤表：`Config.columnLabels`（`{標籤: 類別}`，來自模組設定 `column_labels`）。比對前去掉空白、全半形冒號、`*`、`＊`，英文不分大小寫，完全相同才算。
2. **標題格**：文字符合標籤，且同欄往下第一個非空的格子存在且**不是**標籤。最後一條排除直式表單（姓名／地址／電話上下排在同一欄）。
3. **候選**：同一工作表或表格、同一欄、列號大於標題格的每個非空格，直到該欄出現下一個標題格為止。範圍為該格文字去掉前後空白。
4. 類別為標籤對應的類別；不是內建也不是機構類別時，於執行期加入 `CATEGORIES`（§4），且須通過 §3.3 第 4 點的格式。保留方式依 §3.4，機構類別取該規則的 `retention`。
5. 與規則候選合併時（§3.3 第 4 步），**規則候選排在前面**：等長、同起點時保留規則的類別，例如「電話」欄裡的 `0912-345-678` 仍歸 `手機`。

**預設標籤**（`_MI_JILLDEID_COLUMN_LABELS_DEFAULT`，一行一筆）：

```text
姓名=姓名
學生姓名=姓名
家長姓名=姓名
監護人=姓名
導師=姓名
學號=學號
座號=座號
身分證=身分證
身分證字號=身分證
身分證統一編號=身分證
出生日期=生日
生日=生日
手機=手機
行動電話=手機
電話=市話
聯絡電話=市話
地址=地址
住址=地址
通訊地址=地址
戶籍地址=地址
電子郵件=電子郵件
EMAIL=電子郵件
員工編號=員編
```

**不涵蓋**（列入 §10）：合併儲存格（`mergeCells`、`gridSpan`）造成的欄位錯位、標題跨兩列、沒有標題列的名冊、直式表單（標籤在左、值在右，只靠 §6.4 前後文）。

---

## 7. PHP → 前端設定

`Config::toJson()` 以 `json_encode($cfg, JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT|JSON_UNESCAPED_UNICODE|JSON_THROW_ON_ERROR)` 產生，樣板以 `<{$deid_config_json}>` 輸出（Smarty 未開自動跳脫，不需 `nofilter`）。

```json
{
  "version": 1,
  "assetsBase": "https://example.edu.tw/modules/jill_deid/assets/",
  "orgRules": [
    { "id": "org-3", "name": "學號", "category": "學號",
      "regex": "(?<=學號[:：\\s]*)1\\d{5,6}(?!\\d)", "applyToUrl": true,
      "retention": { "mode": "ends", "head": 3, "tail": 0 },
      "example": "學號 115001", "locked": false }
  ],
  "presets": [
    { "id": 1, "title": "校務資料交 AI 統計", "keepStrategy": "partial",
      "markerStyle": "code", "hyperlinkMode": "mask_pii_in_url",
      "custom": {}, "isDefault": true }
  ],
  "urlPersonalHosts": ["facebook.com", "line.me/ti/p"],
  "columnLabels": { "姓名": "姓名", "學號": "學號", "座號": "座號" },
  "i18n": { "tab.deid": "去識別化", "tab.rules": "偵測規則", "tab.restore": "還原" }
}
```

- `i18n` 物件於 `assets/js/jill/` 需要動態訊息時才加入（目前前台文字都在上游 `ui/` 與樣板）。
- 模組設定 `column_labels` 尚未生效（新增設定項後未按「更新模組」）時，`Config` 退回語言常數 `_MI_JILLDEID_COLUMN_LABELS_DEFAULT`。
- 規則合併順序：內建 → 機構 → 個人。`disabledBuiltins` 可停用 `org-*`，`locked:true` 除外。
- 解析失敗時以空 `orgRules`、`presets` 運作並警告，不中斷。

---

## 8. 分階段實作（每 Phase 一個 PR）

| Phase | 產出 | 完成條件 |
|---|---|---|
| 1a 骨架 | 以 `tad_xmod_maker` 產生（見下）、建 git repo、放入 `docs/spec.md` 與 `CLAUDE.md`，再依本文補齊 `strict_types`、語言常數 | 可安裝、移除、升級，E_ALL 0 警告，xoops-lint 0 error |
| 1b 前端驗證 | §4 轉換（`core/`、`formats/`、`ui/`，vendor 改 side-effect import，佈景相容調整）與第三方檔案；§4 標 P0 的三項修補；`tests/browser/` 最小 runner、`patches.test.js`、`ui.test.js`；上游介面掛載於佈景內，確認五種格式與 OCR；以 H15 確認上游 DOCX 殘留 | H20、H21、H25 與 `ui.test.js` 通過；不通過就停下回報，不進下一個 Phase |
| 2 後台 | Rule、Preset、Config（含 `columnLabels`）、admin 樣板、規則包、`tests/rule_validate_test.php` | §9.3 |
| 3a 前端基礎 | 單一 module worker（§3.3，修補 `ui/process-view.js` 改 async）、機構規則併入偵測、情境下拉與策略對照（§3.4、§6.1 新增 1，由 4a 提前）、`columns.js`（§6.5）、逾時下載確認 | H22–H24、Worker 與主執行緒結果一致、看門狗、`presets.html`、e2e 名冊 12 筆全過 |
| 3b-1 URI 核心 | `uri-scan.js`、`url` 規則、還原 regex、合約文件 | H1–H3、H10、H13、H17–H19、H26 |
| 3b-2 Markdown | `links/markdown.js` | H9 |
| 3b-3 DOCX | rels、欄位碼、Fallback／del、docProps | H4–H7、H15、H16 |
| 3b-4 XLSX | hyperlinks、公式 | H8 |
| 3b-5 PDF＋還原核心 | annotation 偵測、URI 還原 | H12、H14 |
| 4a 去識別化頁 | 修補上游 `ui/process-view.js`：§6.1「本模組新增」2、3、7 項（超連結處理、`🔗`、項目來源標示）；上游功能 1–11 項逐項驗收 | H4、H11 的介面部分；§9.1 |
| 4b 偵測規則頁 | 修補上游 `ui/patterns-view.js`：機構規則分組、測試網址 | §9.3 前台攔截兩項 |
| 4c 還原頁 | 修補上游 `ui/restore-view.js` 接上 URI 還原 | H12 經介面操作一次 |
| 4d 整合 | 本模組範例（`hyperlinks.*`）、已知不涵蓋範圍說明、無障礙、語言檔補齊、上游 `core`／`formats`／`ui` 測試移植（由 3a 移來） | 移植的上游測試全過；§9.4 |
| 5 驗收 | lint、斷網實測、Office 手動開檔 | §9 全勾 |

**Phase 1a 的 maker 設定**（`modules/tad_xmod_maker/index.php?op=add_Form`）：目錄名 `jill_deid`；`min_xoops` 2.7.4；`min_php` **改成 8.3**（預設 8.2）；資料表依 §3。後台選單只建規則與情境頁，前台只留 `index.php`，不建區塊。**不使用 maker 的 CRUD 與表單程式碼**，`pattern` 用 `getText`、刪除走 POST 等要求依 §3、§6.2 手寫。maker 產出的前台 `index.php` 依 §6.1 改寫。

**每個 Phase 的循環**：開分支 → 先把驗收項目寫成測試 → 實作，小步 commit → `check.ps1`（xoops-lint、PHP 規則測試）與瀏覽器測試頁全過 → 合併，並把 AI 犯的錯記入 `CLAUDE.md`。

---

## 9. 驗收條件

### 9.1 環境與隱私

- [ ] XOOPS 2.7.4＋PHP 8.3（`E:\my_xoops274`），`E_ALL` 下安裝、前後台操作 0 Error／Warning／Deprecated。例外（使用者決定不修，2026-11-10）：xbootstrap5 下 TadTools `preloads/core.php:231` 的 `Undefined array key "menu_var_kind"` 與 `class/Tools.php:650` 的兩則 `strpos()` Deprecated，起因是該佈景設定快取 `xoops_data/data/xbootstrap5_setup.json` 沒有 `menu_var_kind`，全站每頁都會出現，與本模組無關。
- [ ] `php D:/workspace/02_Tools/xoops-lint/xoops-lint.php modules/jill_deid` 0 error。
- [ ] DevTools 開 Preserve log，處理 5 種格式各一份並下載，匯出 HAR；`php tools/check-har.php <har> <樣本值檔>` 依 INV-1 確認：所有請求無 body、URL 與標頭不含樣本值；本模組路徑下的請求皆為同站 `GET`；第一個檔案選取後沒有任何第三方請求（以 HAR 的 `startedDateTime` 與操作時間比對，或在選檔前清空 log）。**不可用 grep CDN 字串驗收**，`tesseract.js` 內建預設網址字串必定命中。
- [ ] `node tools/e2e.mjs [佈景 …]` 全部 PASS：以 headless Chrome 在佈景內載入上游範例（五種格式加掃描 PDF 的 OCR）、打包下載、斷網後處理第二份 PDF，並以 CDP 記錄的 HAR 跑 `check-har.php`（含 worker 的請求）。佈景或區塊有變動時重跑。
- [ ] 同一輪確認在站上實際使用的佈景（至少 `xswatch5`、`xbootstrap5`）內，5 種格式與 OCR 都能跑完，console 0 個錯誤；HAR 中佈景與區塊發出的請求同樣不得帶文件內容。
- [ ] 所有模組與 worker 的回應 `Content-Type` 為 JavaScript，`assets/` 內沒有 `.mjs`。
- [ ] 修改 `assets/js/` 任一檔案後一般重新整理（不清快取），瀏覽器會取得新版（§4 快取設定生效）。
- [ ] 各功能各跑一次讓資產進快取後切 DevTools Offline，不重新整理，可完成去識別化與還原，**且同一頁再處理第二份 PDF 也成功**（§4 快取）。
- [ ] 模組位於子目錄與不同網域路徑時，字型、OCR、範例都能載入（即 `assetsBase` 生效）。

### 9.2 超連結測試向量（瀏覽器測試頁，全部 MUST）

`tests/browser/index.html` 以本機站台開啟，頁面顯示通過數與失敗明細。`runner.js` 用最少的程式提供 `describe`、`it`、`expect`，只實作測試真正用到的 matcher，不引入測試框架。

上游測試以同一支工具去型別後放進 `tests/browser/upstream/`。`tests/unit` 的 `core`、`formats` 與 `tests/integration` 應移植；依賴 Node 或 jsdom 而無法直接跑的，改寫或列入 `docs/PATCHES.md` 的略過清單並寫明原因。**不得為了通過而略過與個資偵測、遮罩、還原相關的測試。**

上游 UI 測試（`patterns-view`、`preview`、`output-panel`、`busy` 等）一併移植（v3.7）；`seo` 不移植，因為 `main.ts`、`index.html` 不帶入。原本依賴 jsdom 的測試在瀏覽器以真實 DOM 執行。涉及個資結果的行為（輸出模式與保留方式對照、預覽標記、手動新增項目、批次取消）MUST 移植，逐條列入 `docs/PATCHES.md` 對照表。

預設 `mask_pii_in_url`、`marker=code`、`partial`。

| # | 輸入 | 期待 |
|---|---|---|
| H1 | `mailto:wang.xm@school.edu.tw` | `mailto:<編碼的[電子郵件:x]>@school.edu.tw`，全檔無 `wang.xm` |
| H2 | `tel:0912-345-678` | 解碼後 `tel:0912-[手機:x]` |
| H3 | `https://school.edu.tw/s?id=A123456789&name=%E7%8E%8B%E5%B0%8F%E6%98%8E` | 解碼後 `…?id=A1[身分證:x]&name=王[姓名:y]`，輸出不含 `A123456789`、`%E5%B0%8F%E6%98%8E`、`小明` |
| H4 | 顯示「點此查看」，Target 含 H3 | 顯示不變、Target 改寫、出現 `🔗` |
| H5 | 顯示文字與 Target 含同一身分證 | 同一編碼 |
| H6 | DOCX `HYPERLINK "mailto:wang.xm@…"` | 欄位碼被改寫 |
| H7 | 兩個 `<w:hyperlink>` 共用 rId，僅一個取消 | 產生新 rId，兩者各自正確 |
| H8 | XLSX `HYPERLINK("mailto:…","王小明")` | `<f>`、`<v>` 皆無原值，`<f>` 保留 |
| H9 | `[王小明](https://example.com/u?id=A123456789 "王小明")` 與 `[1]: …` | text、url、title、reference 全部去識別化，且每處只替換一次 |
| H10 | 連結目標（URI 位置）`https://www.facebook.com/wang.xiaoming` | `https://www.facebook.com/<編碼的[網址:x]>` |
| H11 | `marker=label` | 含個資連結自動 strip，UI 提示 |
| H12 | H1–H10 去識別化＋CSV 還原 | 顯示文字逐字一致；URI 依 §5.3 一致；H10 的路徑不得出現 `%2F` 類誤編碼 |
| H13 | 損壞編碼 `%E7%8E` | 不拋例外；整個值以 `網址` 全遮蔽並警示；還原後回到原字串 |
| H14 | PDF `/Link` 含身分證 | `.deid.pdf` 以 `qpdf --qdf` 展開後無原值、無 `/URI` |
| H15 | `tests/browser/fixtures/h15.docx`（`tools/make-h15.ps1` 以 Word 產生）：文字方塊（`mc:Fallback`）、追蹤修訂刪除內容、虛構作者 `測試作者` | 解壓後全檔無原值、無作者（含 `people.xml`）；Word 可正常開啟。Phase 1b 已記錄上游殘留（`h15.test.js`），3b-3 改為期待零殘留 |
| H16 | 欄位碼被拆成 3 個 `instrText` run | 正確改寫，無殘片 |
| H17 | 啟用校務網址參數規則，`?sid=112001` | 命中並只遮 value；`?other=112001` 不因此規則命中 |
| H18 | Big5 `?name=%A4%FD%A4p%A9%FA` | 不拋例外，值全遮蔽並警示 |
| H19 | `http://192.168.1.10/x` | host 命中，連結 strip，UI 標示不可還原 |
| H20 | DOCX：document 開頭為空段落；第一段以 `<w:tab/>` 開頭；頁首開頭為空段落，三者各含身分證與姓名 | 解壓後 `<w:t>` 為 `身分證 [身分證:x] [姓名:y]` 形式，無原值殘字，與預覽文字一致 |
| H21 | XLSX：A2 為數值格 `115001`（無 `t`）、B2 為 `t="n"` 的 `3`、C2 為有 `<f>` 的數值格 | A2、B2 進入 `text`；C2 不進入且 `<f>` 原樣保留；未改動的數值格位元組不變 |
| H22 | XLSX 名冊：第 1 列 `座號 學號 姓名`，以下為數值座號、數值學號、`武大郎`、`章志明` | 三欄全部成為候選，類別依標籤 |
| H23 | DOCX 表格名冊，同 H22 | 同 H22 |
| H24 | 直式表單：A 欄上下為 `姓名`、`地址`、`電話`，B 欄為值 | §6.5 不產生候選（交給 §6.4 與內建規則） |
| H25 | `resolveOverlaps` 新舊版對 5,000 筆隨機重疊候選 | 結果完全相同；8 萬筆不重疊候選 < 100 ms |
| H26 | 文字層裸網址 `https://www.facebook.com/wang.xiaoming`（TXT） | 輸出 `https://www.facebook.com/[網址:x]`，標記不編碼（§5.3） |

`tests/browser/leak-check.js`（MUST）：讀 zip 內**所有文字型項目**，含 `*.rels`，不只 `.xml`；對每個原值檢查原文、`encodeURIComponent`（大小寫 hex）、XML escape、HTML entity 皆不存在。

Fixture 優先沿用上游 `tests/helpers/docx-builder.ts`、`xlsx-builder.ts` 去型別後的版本。

### 9.3 後台

- [ ] 自動化對照：第 1 項 `tests/rule_validate_test.php`；第 2 項 `tests/browser/rulepack.test.js`（lookbehind 須用瀏覽器 RegExp）；第 3、6 項與後台樣板 `tests/admin_db_test.php`；表單試跑 `tests/browser/admin-rule.test.js`。第 4 項於 Phase 4b 驗收；第 5 項需登入後台手動確認。
- [ ] `php tests/rule_validate_test.php`：`(a+)+$`、`(\w*)*x`、`\1`、空字串匹配、`category` 含 `:`、11 字類別、內建類別 `姓名` 皆被拒；8 字中文類別、§6.4 全部 pattern 皆通過。
- [ ] 匯入規則包後，§6.4 七類各以一筆同行標籤的虛構資料測試，全部命中，含 6、7 碼學號、1、2 碼座號與兩種文號。下列不命中：`學費 150000 元`、`座號 123`、`學號 11500123`，且員編規則不得命中 `A123456789`。內文 `?sid=112001 請查閱。` 只命中 `112001`。
- [ ] 實際從表單儲存 `(?<!\d)1\d{5}` 與 `(?<y>\d{4})`，DB 內字串與輸入**完全相同**。
- [ ] 新增校務網址參數規則（`apply_to_url=1`）後，前台重新整理可攔截 `?sid=112001`；設為 0 則不攔 URI。（Phase 4b：偵測規則頁「測試網址」框可直接看結果。站上實測 `apply_to_url=1` 只遮 `sid` 的值；設為 0 由 `patterns-ui.html` 驗證，未改動站上資料。）
- [ ] 寫入 op 以 GET 呼叫、缺 token、非管理員皆被拒。
- [ ] `is_default` 全站只有一筆。

### 9.4 無障礙與語言

- [ ] 前後台模組內容皆無 `<h1>`、`<h2>`，從 `<h3>` 起且層級不跳階。
- [ ] `*.php`（語言檔除外）、`*.tpl`、`assets/js/jill/**/*.js` 無硬寫中文（上游 `ui/` 依 §4 i18n 例外）；`assets/js/jill/` 與樣板無 `innerHTML`；`assets/css/upstream.css`、`jill_deid.css` 每條規則都在範圍內（`ui.test.js`）。
- [ ] 互動元件 ≥ 44×44 px、文字對比 ≥ 4.5:1、純圖示按鈕有 `visually-hidden` 文字。
- [ ] 鍵盤可完成整個流程；axe DevTools 0 個 serious／critical。

---

## 10. 範圍與已知殘留

**不在本版範圍**：

- 伺服器端任何文件處理。
- PDF 還原時重建連結。
- 英文姓名、地址偵測；`.doc`、`.xls`、`.pptx`、圖片輸入；調整上游 regex 的準確度（§4 P0 修補與 §6.5 除外）。
- `mask_whole_url` 模式。要做時須先定義 `https://invalid.invalid/` 的還原合約。

**已知殘留（MUST 在 UI 與說明告知，不得宣稱完全無殘留）**：

- Excel：以數值儲存、又不在 §6.5 標籤欄內的電話（前導 0 已遺失，規則比不到）；公式（含 `HYPERLINK` 以外）及其快取值；工作表名稱；定義名稱。
- URI：雙重編碼（`%25E7…`）、Base64、自訂編碼的參數值。
- 文件內嵌圖片裡的文字（PDF 掃描檔由 OCR 重建者除外）。
- **名冊（v3.6 改由 §6.5 處理）**：欄首標籤偵測不涵蓋合併儲存格造成的欄位錯位、標題跨兩列、沒有標題列的名冊；UI MUST 提醒使用者人工檢查這類名冊。
- **姓名**：內建偵測靠姓氏表與前後文，表外姓氏不命中（已確認武、史、熊、章、尹、崔、賀、俞、靳不在表內）；只有在 §6.5 標籤欄內才補得到。UI MUST 提醒人工檢查，不得宣稱可全部抓到。
- **身分證號**：內建規則只比對第 2 碼為 1、2 的國民身分證，且檢核碼錯誤不命中；居留證（如 `A800000014`、`AC01234567`）不命中。有外籍師生時，須另加機構規則。
