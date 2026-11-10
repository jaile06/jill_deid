<?php

declare(strict_types=1);

require_once __DIR__ . '/header.php';

// 佈景含行內腳本，無法套嚴格 CSP；只送 Referrer-Policy，避免連結帶出本頁網址
header('Referrer-Policy: no-referrer');

$GLOBALS['xoopsOption']['template_main'] = 'jill_deid_index.tpl';
require_once XOOPS_ROOT_PATH . '/header.php';

// ponytail: Phase 1a 只有外框；Config::toJson()（§7）於 Phase 2 加入

require_once XOOPS_ROOT_PATH . '/footer.php';
