<?php

declare(strict_types=1);

// 前台獨立頁（規格 §6.1）：不載入 XOOPS_ROOT_PATH/header.php，佈景與區塊的 JS 不得與文件內容同源執行
require_once __DIR__ . '/header.php';
$GLOBALS['xoopsLogger']->activated = false;    // 避免除錯輸出注入行內內容

header("Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; connect-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'self'");
header('Referrer-Policy: no-referrer');

// ponytail: Phase 1a 只有外框；Config::toJson()（§7）於 Phase 2 加入
$tpl = new \XoopsTpl();
$tpl->display('db:jill_deid_app.tpl');
