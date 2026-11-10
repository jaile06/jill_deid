<?php

declare(strict_types=1);

require_once __DIR__ . '/header.php';

// 佈景含行內腳本，無法套嚴格 CSP；只送 Referrer-Policy，避免連結帶出本頁網址
header('Referrer-Policy: no-referrer');

$GLOBALS['xoopsOption']['template_main'] = 'jill_deid_index.tpl';
require_once XOOPS_ROOT_PATH . '/header.php';

// ponytail: Config::toJson()（§7）於 Phase 2 加入
// upstream.css 由轉換工具產生（限定在 #jill-deid-app 內）；jill_deid.css 補佈景 Bootstrap 的同名 class
$xoTheme->addStylesheet('modules/jill_deid/assets/css/upstream.css');
$xoTheme->addStylesheet('modules/jill_deid/assets/css/jill_deid.css');
// vendor 由用到的模組自行 import（spec §4），這裡不載入
$xoTheme->addScript('modules/jill_deid/assets/js/jill/main.js', ['type' => 'module']);

require_once XOOPS_ROOT_PATH . '/footer.php';
