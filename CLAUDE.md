# jill_deid — AI 協作須知

- **唯一事實來源**：`docs/spec.md`（規格書 v3.3）。與 convention 衝突以 spec 為準。
- 通用規範：`g:\我的雲端硬碟\note\Templates\開發範本\OpenSpec-XOOPS-convention.md`、`XOOPS-安全開發檢查清單.md`。
- 一次只做一個 Phase（spec §8），每個 Phase 一個分支；合併前 `./check.ps1` 全過。
- PHP：`E:\my_xoops274\core\php83\php.exe`；lint：`php D:/workspace/02_Tools/xoops-lint/xoops-lint.php .`

## 目前進度

| Phase | 狀態 |
|---|---|
| 1a 骨架 | 完成（分支 `phase-1a`），待瀏覽器實測安裝／移除／升級 |
| 1b 前端驗證 | 未開始 |

## 本模組特有的鐵則（spec 摘要，細節回 spec 查）

- `pattern`、`retention`、`custom_config` 一律 `Request::getText(name, '', 'POST')`，**禁 `getString`**（會破壞 regex，spec §B）。
- 刪除／切換走 POST 表單＋token，**不用 `SweetAlert::render()`**（只能 GET，spec §6.2）。
- 權限：寫入 op 依序 POST → `xoops_security_check()` → `$xoopsUser->isAdmin($xoopsModule->mid())`；不看 `$_SESSION`。
- **偏離 spec §6.1（2026-11-10 使用者決定）**：前台 `index.php` 走一般 XOOPS 流程（`header.php`／`footer.php`、套佈景），不用獨立頁、不送 CSP。標題從 `<h3>` 起。零外傳（INV-1）改靠 §9.1 HAR 實測把關；spec 中凡以獨立頁或 CSP 為前提的條目（§6.1、§9.1 CSP violation、§9.4 唯一 h1）以此為準。
- PHP 不接收文件：不讀 `$_FILES`、不寫 `uploads/`。

## AI 犯過的錯（每個 Phase 結束時補）

- （Phase 1a）maker 產出的 CRUD 含 `$$key`、GET 刪除、session 權限判斷，已整批移除；Phase 2 依 spec 手寫，不要從 git 歷史撈回來。
