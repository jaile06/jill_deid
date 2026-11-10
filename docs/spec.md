---
title: "XOOPS 模組開發規格書：文件去識別化工具（jill_deid）"
version: 3.3
created: 2026-11-06
updated: 2026-11-06
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
7. **已定案，不要重新提議**（2026-11-06 使用者確認）：前台為不套佈景的獨立頁；`mask_whole_url` 延後；基準為 XOOPS 2.7.4、PHP 8.3，不支援 2.5.11；資料表用 MyISAM；校務資料涵蓋學號、座號、員編、文號、身分證號、姓名、EMAIL（§6.4）；骨架由 `tad_xmod_maker` 產生；前台為 PHP＋原生 JS，開發與上線都不用 Node 建置（§4）。
8. §A 的路徑與行號指上游 TypeScript 原始碼；本模組對應檔案是 `assets/js/upstream/` 下的同名 `.js`。

---

## A. 上游事實（已對照原始碼）

| 項目 | 事實 | 位置 |
|---|---|---|
| 技術棧 | Vite 8（Node `^20.19 \|\| >=22.12`）、TypeScript 7、無框架、vitest＋jsdom，33 個測試檔 | `package.json` |
| 內建規則 | 15 條。`tw` 7 條：`zh-name tw-id tw-mobile tw-landline tw-address tw-company tw-tax-id`；`intl` 8 條：`email us-ssn intl-phone credit-card iban ipv4 ipv6 dob`。可含 `validate` 函式（檢核碼），因此不能傳進 Worker | `core/patterns.ts` |
| 類別 | `CATEGORIES` 是封閉清單，型別也是 union；UI 用它產生下拉選單與類別統計（`process-view.ts:597,664,843`），不在清單內的類別不會出現在統計與批次取消 | `core/types.ts` |
| 標記 | `[類別:6碼小寫hex]`，regex `\[([^\[\]:]{1,10}):([0-9a-f]{6})\]` | `core/codes.ts` |
| 編碼共用 | `CodeBook` 鍵為 `類別:head:tail:原值`。同值但保留長度不同，編碼就不同 | `core/codes.ts` |
| CSV | `code,category,original[,kept_prefix,kept_suffix]`；`original` 只存被隱藏的部分。還原只以 `code` 查表 | `core/csv.ts`、`core/restorer.ts` |
| 偵測 | `detect(text, patterns, book)` 為**同步**函式，在主執行緒執行；重疊時最長者優先（`resolveOverlaps` 未 export）。呼叫點：`process-view.ts:239,279` | `core/detector.ts` |
| 管線 | 全部以 `LoadedDocument.text` 的 **offset** 運作（`RedactionItem.start/end`、`TextEdit`）。超連結 URI 不在 `text` 裡，**現行管線碰不到** | `core/types.ts` |
| 輸出模式 | `OutputMode = 'code'（全部隱藏）\|'preview'\|'custom'`；`MarkerStyle = 'code'\|'label'\|'blank'`。`preview` 對所有類別套 `standardSplit`，未知類別預設露出第 1 字；`custom` 為 `overrides[類別] ?? it.retention`，未設定則全部隱藏 | `ui/process-view.ts:101-111` |
| 個人規則 | `localStorage` key `deid.patternConfig.v1`：`{version, disabledBuiltins, customPatterns, retention?}` | `core/pattern-store.ts` |
| 上限 | `MAX_FILES = 10`、`MAX_FILE_BYTES = 100MB` | `process-view.ts:16`、`types.ts` |
| 資產路徑 | `BASE_URL`（`./`）以 **document 網址**解析，共 3 處：`pdf.ts:14` 字型、`ocr.ts:605` OCR、`samples.ts:11` 範例 | 見左 |
| DOCX | 只解析 `document.xml`、`header*`、`footer*` 的 `<w:t>`。**`mc:Fallback` 與 `w:del` 被跳過，內容原樣留在輸出檔** | `formats/docx.ts` |
| XLSX | 只處理 `t="s"`、`inlineStr` 儲存格；公式快取（`t="str"`）不讀；未被引用的 sharedStrings 已會清空 | `formats/xlsx.ts` |
| PDF | 以 `PDFDocument.create()` 重建，原 Annotation、Outline、Info 不會帶出 | `formats/pdf.ts` |
| TXT／MD | 整段純文字，沒有連結語法意識 | `formats/plaintext.ts` |
| UI 入口 | `main.ts` 匯入即 `mount()`，內含 `h1`、作者社群連結、`innerHTML`、FAQ dialog，**只能取代，不能包裝**。各分頁用 `h2` | `src/main.ts` |
| OCR | 已指向同站資產，但 `tesseract.js` 程式內仍有 jsDelivr 預設網址字串（有傳路徑時不會連線）；預設以 blob URL 啟動 worker | `formats/ocr.ts:605-612` |

## B. XOOPS 基準事實（`E:\my_xoops274\www` 已驗證）

| 項目 | 事實 |
|---|---|
| 版本 | XOOPS 2.7.4、Smarty 4.5.8、`xoops_lib` 位於 `E:\my_xoops274\xoops_lib`。可用 PHP：`E:\my_xoops274\core\php8{1..5}\php.exe` |
| TadTools | 4.0.8-Stable，`min_php = 8.3` |
| Smarty | 沒有開啟自動跳脫，輸出須明寫 `\|escape`。`nofilter` 語法有效但多餘，JSON 區塊直接輸出變數即可。未註冊的 PHP 函式當 modifier 會觸發 Deprecated |
| `Xmf\Request::getString` | **會破壞 regex**：實測 `(?<!\d)1` → `(?!\d)1`（語意反轉）、`(?<y>\d{4})` → `(?\d{4})`、`a<b>c` → `ac`。`Request::getText` 三者皆保留 |
| 模組存取權 | `include/common.php` 已自動檢查 `module_read`，模組內不必重寫 |
| 佈景 | `xswatch5`、`xbootstrap5` 的 `theme.tpl` 含行內 `<script>`；SweetAlert 也以行內 JS 輸出。套嚴格 CSP 會壞 |
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
   - **INV-1 零外傳**：前台頁面載入後，只允許同站 `GET` 靜態資產，不得有帶文件內容的請求。CSP 是縱深防禦，**不是保證**（`connect-src 'self'` 仍允許送往同站），驗收以 §9.1 實測為準。
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
├── index.php                 ← 前台獨立頁（§6.1）
├── admin/{menu,main,header,footer,about}.php
├── class/
│   ├── Rule.php              ← CRUD、validate()（純函式，無 XOOPS 相依）、import_pack()
│   ├── Preset.php            ← CRUD、custom_config 驗證
│   ├── Config.php            ← 組前台設定 JSON（§7）
│   ├── Tools.php             ← 由 dinfo 精簡
│   └── Update.php
├── preloads/{autoloader,core}.php
├── templates/
│   ├── jill_deid_app.tpl     ← 前台完整 HTML 文件，不套佈景
│   ├── jill_deid_admin.tpl
│   └── op_jill_deid_{rule,preset}_{index,form}.tpl
├── assets/
│   ├── js/upstream/{core,formats,ui}/*.js   ← 上游去型別後的程式，之後直接修改（§4）
│   ├── js/jill/              ← main.js、i18n.js、assets.js、uri-scan.js、links/*、regex.worker.js
│   ├── vendor/               ← 第三方現成檔，勿手改
│   ├── css/jill-deid-app.css ← 上游 styles.css
│   ├── fonts/NotoSansTC-Regular.ttf、ocr/{worker.min.js,core/,lang/}、samples/
│   ├── .htaccess             ← 快取設定（§4）
│   └── THIRD_PARTY_NOTICES.txt
├── docs/{spec.md,PATCHES.md,VENDOR.md,marker-in-uri.md}
├── tools/{strip-upstream.mjs,check-har.php}
├── tests/
│   ├── rule_validate_test.php   ← 純 assert，免 XOOPS、免 PHPUnit
│   └── browser/                 ← 瀏覽器測試頁（§9.2）：index.html、runner.js、§9.2 向量、leak-check.js、upstream/
├── CLAUDE.md、check.ps1
├── language/{tchinese_utf8,english}/{modinfo,main,admin}.php（english SHOULD，至少 modinfo）
└── sql/mysql.sql
```

命名：`op` 為 `[entity]_[動作]`；常數 `_MI_JILLDEID_*`、`_MD_JILLDEID_*`、`_AM_JILLDEID_*`。

模組設定（`$modversion['config']`）：`url_personal_hosts`（textarea，一行一筆，預設值見 §5.2）。其餘上限沿用上游常數，不開放設定。

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
2. 拒絕災難性回溯結構：巢狀量詞（`(a+)+`、`(\w*)*`、`(.*){2,}`）、可重疊交替後接量詞（`(a|a)+`）、反向引用 `\1`。以 regex 黑名單實作，lookbehind 不算違規。
3. 空字串：`@preg_match('/' . str_replace('/', '\/', $p) . '/u', '')` 回傳 `1` 就拒絕；回傳 `false` 代表 PCRE 不支援該語法，不算錯，交給第 6 點。
4. `category`：`preg_match('/^[^\[\]:\s]{1,10}$/u', ...)`（**必須 `/u`**，否則以位元組計算，4 個中文字就超過），且不得與內建類別或保留字 `網址` 同名。
5. `retention`：通過 §3.4。

6. **後台表單 JS（輔助）**：沿用上游 `validateRegex`（`new RegExp(p,'gu')`、不可匹配空字串）；在 Worker 內以 `sample_text` 試跑，200 ms 逾時或零命中都拒絕送出。

**前台執行**：機構與自訂規則（無 `validate` 函式）MUST 在 Worker 執行；內建規則留在主執行緒。流程：

1. 每條規則各自送 Worker，收回 `[start,end][]`，單檔單規則 2 秒逾時即 `terminate()`，UI 警示「規則 X 逾時已略過」。
2. 主執行緒併入候選後做 `resolveOverlaps`。
3. `detect()` 因此要改為接受額外候選，兩個呼叫點改 async（§4 PATCHES）。

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
| `custom` | `custom` | `custom_config[類別]`，未列出＝全隱藏 | `custom_config[類別]` ?? 規則 `retention` ?? 全隱藏 |

`custom_config` 格式 `{ "<類別>": <Retention> }`，載入時寫入 `state.overrides`（記憶體），**不寫 localStorage**。未列出一律隱藏，與上游一致，避免設定遺漏造成外洩。

---

## 4. 上游移植方式

**只取用** `src/`、`tests/`、`public/fonts/`、`public/samples/`、`LICENSE`。不要帶入 `.claude/`、`.specify/`、`docs/`、`examples/`、`index.html`、SEO 檔、`llms*`、`og.png`。

**一次性轉換**（`tools/strip-upstream.mjs`，執行者用現有的 Node 22.13 以上跑一次；結果提交進 repo，之後不再需要 Node）：

1. 以 `node:module` 的 `stripTypeScriptTypes(src, {mode:'strip'})` 轉 `src/**/*.ts`。上游沒有 `enum`、`namespace` 或建構子參數屬性，去型別不改語意（已實測：30 檔全部成功，語法檢查 0 失敗）。
2. 相對 import 補 `.js`（共 57 處）；套件 import 依下表改寫。**不可用 import map**，它是行內 script，會被 CSP 擋下。
3. **第一個 commit 只放未修改的轉換結果**，之後 `git diff` 才看得出對上游的修改。

| 上游 | 本模組 |
|---|---|
| `jszip` | `assets/vendor/jszip.min.js`（傳統 script），改為 `globalThis.JSZip` |
| `@pdf-lib/fontkit` | `fontkit.umd.min.js`（傳統 script），改為 `globalThis.fontkit` |
| `libphonenumber-js` | `libphonenumber-min.js`（傳統 script），改為 `globalThis.libphonenumber` |
| `pdf-lib` | `pdf-lib.esm.min.js`，相對路徑 import |
| `pdfjs-dist`、`?url` worker | `pdf.min.js`、`pdf.worker.min.js`（來源 `.mjs` 存檔時改副檔名，避免 Apache 回錯 MIME）；worker 路徑由 `assetsBase` 組成 |
| `tesseract.js`（動態 import） | `tesseract.esm.min.js`；OCR 的 worker、core、語言檔放 `assets/ocr/`，檔名同上游 `OCR_ASSETS` |
| `import './styles.css'` | 移除，由樣板載入 `css/jill-deid-app.css` |
| `import.meta.env.BASE_URL` | `jill/assets.js` 的 `assetsBase` |

全域變數名稱與 `tesseract` 的 default export 尚未實跑，Phase 1b 要確認。

**第三方檔案**：版本以上游 `package-lock.json` 為準，由 npm registry 或 unpkg 下載一次。`docs/VENDOR.md` 記錄每個檔案的來源網址、版本與 SHA-256。

**快取**：沒有打包就沒有帶 hash 的檔名，`?v=` 也傳不到子模組。`assets/.htaccess` 在 `<IfModule mod_headers.c>` 內對 `js/`、`vendor/`、`css/` 設 `Cache-Control: no-cache`，讓瀏覽器每次驗證 ETag，升級後才不會混用新舊模組。

**跟進上游**：不做自動合併。把新版轉到暫存目錄，與前一版轉換結果比對，再手動套入 `assets/js/upstream/`。

上游檔案不可能完全不改。**下列為核准的修改點**（路徑相對於 `assets/js/upstream/`），`docs/PATCHES.md` 逐條記錄；清單外的修改要先提問：

| 檔案 | 修改 |
|---|---|
| `main.js` | 不引用，由 `jill/main.js` 取代：移除社群連結、FAQ、`innerHTML`、外部說明連結；頁籤補 `role="tablist"` 與方向鍵 |
| `formats/pdf.js`、`formats/ocr.js`、`ui/samples.js` | 改用 `jill/assets.js` 的 `assetsBase`；pdf.js 若觸發 CSP eval 違規，加 `isEvalSupported:false` |
| `core/types.js` | `CATEGORIES` 可於執行期加入機構類別與 `網址`；`LoadedDocument` 增加選用的 `links`（`LinkTarget[]`）。型別宣告已隨去型別移除，新程式以 JSDoc 標註 |
| `core/retention.js` | `standardSplit` 增加 `case '網址'` |
| `core/patterns.js` | 新增 `url` 規則（§5.2） |
| `core/pattern-store.js` | `STORAGE_KEY` 改 `jill_deid.patternConfig.v1`；`getEffectivePatterns` 併入機構規則 |
| `core/detector.js` | export `resolveOverlaps`；`detect` 接受額外候選 |
| `core/restorer.js` | 增加 URI 位置還原（§5.3） |
| `formats/index.js` | `generateDocument(doc, edits, linkEdits = [])` |
| `formats/docx.js`、`xlsx.js`、`pdf.js`、`plaintext.js` | 依 §5.5 擴充 |
| `ui/process-view.js`、`preview.js`、`restore-view.js`、`patterns-view.js` | 情境、超連結模式、`🔗`、機構規則分組、async 偵測、策略對照 |

i18n：PHP、tpl 一律語言常數。`assets/js/jill/` 的字串走 `t(key)`。上游 `ui/*.js` 的中文首版不抽離，缺 key 回退原文，列入 `docs/PATCHES.md` 待辦。

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
interface LinkHit { category: string; code: string; retention?: Retention }
interface LinkDecision { linkId: string; action: 'rewrite' | 'strip' | 'keep'; uri?: string; hits: LinkHit[] }
function scanUri(uri: string, patterns: Pattern[], book: CodeBook): LinkDecision;
```

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

**XLSX**

1. `xl/worksheets/sheetN.xml` 的 `<hyperlink>`：`display`、`tooltip`、`location` 走一般偵測，`r:id` 目標由上述 `*.rels` 規則處理。
2. 公式 `<f>HYPERLINK("url","text")</f>`：解析字串參數改寫，**同步改 `t="str"` 的 `<v>`**。上游不讀這類儲存格，要新增。不可沿用 `setInlineString`，它會刪除 `<f>`。
3. 註解 `xl/comments*.xml`、`xl/threadedComments/*`：SHOULD。
4. `docProps/*` 同 DOCX。

**PDF**：輸出重建已滿足 INV-2。新增以 `page.getAnnotations()` 讀 `Link` 的 `url`、`rect`，`writable:false`，UI 顯示「此頁有含個資的連結，輸出時連結會移除」。輸出與還原都不重建連結。

**Markdown／貼上文字**（`assets/js/jill/links/markdown.js`）：辨識 `[text](url "title")`、`![alt](url)`、`<https://…>`、`<mailto:…>`、`[id]: url "title"`、`<a href="…">`、裸網址。

- `text`、`alt`、`title` 走一般偵測；`url` 範圍走 §5.1，並**從一般偵測排除**，以免同一處被改兩次。
- 程式碼區塊內仍要掃描。

**TXT**：只處理裸網址與 `mailto:`、`tel:`。

---

## 6. 功能

### 6.1 前台 `index.php`：獨立頁，不套佈景

**理由**：佈景有行內腳本，嚴格 CSP 會壞；更重要的是佈景與區塊的 JS 和文件內容同源，可讀取預覽內容，繞過「零外傳」。上游各分頁的 `h2` 也因此不必改。

```php
<?php
use XoopsModules\Jill_deid\Config;

require_once __DIR__ . '/header.php';          // mainfile + interface；不載入 XOOPS_ROOT_PATH/header.php
$GLOBALS['xoopsLogger']->activated = false;    // 避免除錯輸出注入行內內容

header("Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; connect-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'self'");
header('Referrer-Policy: no-referrer');

$tpl = new \XoopsTpl();
$tpl->assign('deid_config_json', Config::toJson());
$tpl->display('db:jill_deid_app.tpl');
```

`jill_deid_app.tpl` 是完整 HTML 文件，含：`<html lang>`、唯一的 `<h1>`、返回網站首頁連結、`<script id="jill-deid-config" type="application/json">`、CSS、`jszip`／`fontkit`／`libphonenumber` 三個傳統 `<script src>`，以及 `<script type="module" src="…/js/jill/main.js">`。

**本頁為 convention §7「禁用 h1／h2」的明確例外**，xoops-lint 的 warn 以 `xoops-lint-ignore` 標註；後台樣板仍從 `<h3>` 起。

沿用上游三頁籤，新增：

1. 頂部情境下拉，預設 `isDefault`。切換只呼叫 `resplitItems`，不重新解析檔案。
2. 輸出設定新增「超連結處理」（§5.4）。
3. 含個資連結旁的 `🔗` `<button>`（`aria-label` 走 i18n）：彈出層對照顯示文字與連結的前後差異，可取消或移除連結；鍵盤可開啟、`Esc` 關閉。沒有 `displayRange` 的連結列在檔案上方的「文件連結」清單。
4. 偵測規則頁新增「機構共用規則」分組（唯讀，非 locked 可停用）與「測試網址」框（顯示解碼組件與命中位置）。
5. 範例 `samples/hyperlinks.{docx,xlsx,md}`，虛構資料，由腳本產生。
6. UI 明示已知不涵蓋範圍（§10）。

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
| 座號 | 2 碼數字 |
| 員編 | 第 1 碼為英文大寫字母（不限 A），範例 `A200038`；其後 6 碼數字依此範例推定 |
| 文號 | 固定 10 碼數字。範例 `教課（一）字第1141431254號`、`字第1140087197A號`；結尾字母依範例推定為可省略的 1 個大寫字母 |

學號、座號是純數字，沒有固定前綴，一定要有標籤上下文，否則 `1\d{5,6}` 會把金額 `150000` 也遮掉。員編、文號有自己的特徵，不需要標籤。

| title | category | pattern | retention | sample_text |
|---|---|---|---|---|
| 學號 | 學號 | `(?<=學號[:：\s]*)1\d{5,6}(?!\d)` | `ends 3/0` | 學號 115001 |
| 座號 | 座號 | `(?<=座號[:：\s]*)\d{2}(?!\d)` | `none` | 座號 03 |
| 教職員編號 | 員編 | `(?<![A-Za-z0-9])[A-Z]\d{6}(?!\d)` | `none` | 員編 A200038 |
| 公文字號 | 文號 | `(?<=字第)\d{10}[A-Z]?(?=號)` | `none` | 教課（一）字第1140087197A號 |
| 校務網址參數 | 學號 | `(?<=[?&](?:stu\|sid\|student_id)=)[^&#]+` | `none` | `?sid=112001` |

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
  "i18n": { "tab.deid": "去識別化", "tab.rules": "偵測規則", "tab.restore": "還原" }
}
```

- 規則合併順序：內建 → 機構 → 個人。`disabledBuiltins` 可停用 `org-*`，`locked:true` 除外。
- 解析失敗時以空 `orgRules`、`presets` 運作並警告，不中斷。

---

## 8. 分階段實作（每 Phase 一個 PR）

| Phase | 產出 | 完成條件 |
|---|---|---|
| 1a 骨架 | 以 `tad_xmod_maker` 產生（見下）、建 git repo、放入 `docs/spec.md` 與 `CLAUDE.md`，再依本文補齊 `strict_types`、語言常數 | 可安裝、移除、升級，E_ALL 0 警告，xoops-lint 0 error |
| 1b 前端驗證 | §4 轉換與第三方檔案、`index.php` 獨立頁載入上游介面；確認全域變數、CSP、五種格式與 OCR；以 H15 確認上游 DOCX 殘留 | 不通過就停下回報，不進下一個 Phase |
| 2 後台 | Rule、Preset、Config、admin 樣板、規則包、`tests/rule_validate_test.php` | §9.3 |
| 3a 前端移植 | `jill/main.js`、assets、i18n、Worker 化、瀏覽器測試頁 | 移植的上游測試全過；§9.1 全過 |
| 3b-1 URI 核心 | `uri-scan.js`、`url` 規則、還原 regex、合約文件 | H1–H3、H10、H13、H17–H19 |
| 3b-2 Markdown | `links/markdown.js` | H9 |
| 3b-3 DOCX | rels、欄位碼、Fallback／del、docProps | H4–H7、H15、H16 |
| 3b-4 XLSX | hyperlinks、公式 | H8 |
| 3b-5 PDF＋還原 | annotation 偵測、restore-view | H12、H14 |
| 4 前台整合 | 情境、`🔗`、機構規則分組、範例、無障礙 | H11、§9.4 |
| 5 驗收 | lint、斷網實測、Office 手動開檔 | §9 全勾 |

**Phase 1a 的 maker 設定**（`modules/tad_xmod_maker/index.php?op=add_Form`）：目錄名 `jill_deid`；`min_xoops` 2.7.4；`min_php` **改成 8.3**（預設 8.2）；資料表依 §3。後台選單只建規則與情境頁，前台只留 `index.php`，不建區塊。**不使用 maker 的 CRUD 與表單程式碼**，`pattern` 用 `getText`、刪除走 POST 等要求依 §3、§6.2 手寫。maker 產出的前台 `index.php` 由 §6.1 的獨立頁取代。

**每個 Phase 的循環**：開分支 → 先把驗收項目寫成測試 → 實作，小步 commit → `check.ps1`（xoops-lint、PHP 規則測試）與瀏覽器測試頁全過 → 合併，並把 AI 犯的錯記入 `CLAUDE.md`。

---

## 9. 驗收條件

### 9.1 環境與隱私

- [ ] XOOPS 2.7.4＋PHP 8.3（`E:\my_xoops274`），`E_ALL` 下安裝、前後台操作 0 Error／Warning／Deprecated。
- [ ] `php D:/workspace/02_Tools/xoops-lint/xoops-lint.php modules/jill_deid` 0 error。
- [ ] DevTools 開 Preserve log，處理 5 種格式各一份並下載，匯出 HAR；`php tools/check-har.php <har> <樣本值檔>` 確認所有請求皆同站、`GET`、無 body，URL 不含樣本值。**不可用 grep CDN 字串驗收**，`tesseract.js` 內建預設網址字串必定命中。
- [ ] 同一輪確認 CSP 下 5 種格式與 OCR 都能跑完，console 0 個 CSP violation。
- [ ] 所有模組與 worker 的回應 `Content-Type` 為 JavaScript，`assets/` 內沒有 `.mjs`。
- [ ] 修改 `assets/js/` 任一檔案後一般重新整理（不清快取），瀏覽器會取得新版（§4 快取設定生效）。
- [ ] 各功能各跑一次讓資產進快取後切 DevTools Offline，不重新整理，可完成去識別化與還原。
- [ ] 模組位於子目錄與不同網域路徑時，字型、OCR、範例都能載入（即 `assetsBase` 生效）。

### 9.2 超連結測試向量（瀏覽器測試頁，全部 MUST）

`tests/browser/index.html` 以本機站台開啟，頁面顯示通過數與失敗明細。`runner.js` 用最少的程式提供 `describe`、`it`、`expect`，只實作測試真正用到的 matcher，不引入測試框架。

上游測試以同一支工具去型別後放進 `tests/browser/upstream/`。`tests/unit` 的 `core`、`formats` 與 `tests/integration` 應移植；依賴 Node 或 jsdom 而無法直接跑的，改寫或列入 `docs/PATCHES.md` 的略過清單並寫明原因。**不得為了通過而略過與個資偵測、遮罩、還原相關的測試。**

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
| H10 | `https://www.facebook.com/wang.xiaoming` | `https://www.facebook.com/<編碼的[網址:x]>` |
| H11 | `marker=label` | 含個資連結自動 strip，UI 提示 |
| H12 | H1–H10 去識別化＋CSV 還原 | 顯示文字逐字一致；URI 依 §5.3 一致；H10 的路徑不得出現 `%2F` 類誤編碼 |
| H13 | 損壞編碼 `%E7%8E` | 不拋例外；整個值以 `網址` 全遮蔽並警示；還原後回到原字串 |
| H14 | PDF `/Link` 含身分證 | `.deid.pdf` 以 `qpdf --qdf` 展開後無原值、無 `/URI` |
| H15 | DOCX 含文字方塊（`mc:Fallback`）與追蹤修訂刪除內容 | 解壓後全檔無原值；Word 可正常開啟 |
| H16 | 欄位碼被拆成 3 個 `instrText` run | 正確改寫，無殘片 |
| H17 | 啟用校務網址參數規則，`?sid=112001` | 命中並只遮 value；`?other=112001` 不因此規則命中 |
| H18 | Big5 `?name=%A4%FD%A4p%A9%FA` | 不拋例外，值全遮蔽並警示 |
| H19 | `http://192.168.1.10/x` | host 命中，連結 strip，UI 標示不可還原 |

`tests/browser/leak-check.js`（MUST）：讀 zip 內**所有文字型項目**，含 `*.rels`，不只 `.xml`；對每個原值檢查原文、`encodeURIComponent`（大小寫 hex）、XML escape、HTML entity 皆不存在。

Fixture 優先沿用上游 `tests/helpers/docx-builder.ts`、`xlsx-builder.ts` 去型別後的版本。

### 9.3 後台

- [ ] `php tests/rule_validate_test.php`：`(a+)+$`、`(\w*)*x`、`\1`、空字串匹配、`category` 含 `:`、11 字類別、內建類別 `姓名` 皆被拒；8 字中文類別、§6.4 全部 pattern 皆通過。
- [ ] 匯入規則包後，§6.4 七類各以一筆同行標籤的虛構資料測試，全部命中，含 6、7 碼學號與兩種文號。下列不命中：`學費 150000 元`、`座號 123`、`學號 11500123`，且員編規則不得命中 `A123456789`。
- [ ] 實際從表單儲存 `(?<!\d)1\d{5}` 與 `(?<y>\d{4})`，DB 內字串與輸入**完全相同**。
- [ ] 新增校務網址參數規則（`apply_to_url=1`）後，前台重新整理可攔截 `?sid=112001`；設為 0 則不攔 URI。
- [ ] 寫入 op 以 GET 呼叫、缺 token、非管理員皆被拒。
- [ ] `is_default` 全站只有一筆。

### 9.4 無障礙與語言

- [ ] 前台只有一個 `<h1>`、標題層級不跳階；後台無 `<h1>`、`<h2>`。
- [ ] `*.php`（語言檔除外）、`*.tpl` 無硬寫中文。
- [ ] 互動元件 ≥ 44×44 px、文字對比 ≥ 4.5:1、純圖示按鈕有 `visually-hidden` 文字。
- [ ] 鍵盤可完成整個流程；axe DevTools 0 個 serious／critical。

---

## 10. 範圍與已知殘留

**不在本版範圍**：

- 伺服器端任何文件處理。
- PDF 還原時重建連結。
- 英文姓名、地址偵測；`.doc`、`.xls`、`.pptx`、圖片輸入；調整上游偵測準確度。
- `mask_whole_url` 模式。要做時須先定義 `https://invalid.invalid/` 的還原合約。

**已知殘留（MUST 在 UI 與說明告知，不得宣稱完全無殘留）**：

- Excel：以數值儲存的電話、證號；非 `HYPERLINK` 公式及其快取值；工作表名稱；定義名稱。
- URI：雙重編碼（`%25E7…`）、Base64、自訂編碼的參數值。
- 文件內嵌圖片裡的文字（PDF 掃描檔由 OCR 重建者除外）。
- **直欄名冊（已用草案 regex 實測）**：標籤在欄首、值在下方列時，學號、座號不命中，員編、文號不受影響。學號、座號是純數字，拿掉標籤會誤遮金額，本版也不做欄位感知偵測；UI MUST 提醒使用者人工檢查名冊的這兩欄。
- **姓名**：內建偵測靠姓氏表與前後文，表外姓氏不命中（已確認武、史、熊、章、尹、崔、賀、俞、靳不在表內）。UI MUST 提醒人工檢查，不得宣稱可全部抓到。
- **身分證號**：內建規則只比對第 2 碼為 1、2 的國民身分證，且檢核碼錯誤不命中；居留證（如 `A800000014`、`AC01234567`）不命中。有外籍師生時，須另加機構規則。
