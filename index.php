<?php

declare(strict_types=1);

require_once __DIR__ . '/header.php';

// 佈景含行內腳本，無法套嚴格 CSP；只送 Referrer-Policy，避免連結帶出本頁網址
header('Referrer-Policy: no-referrer');

$GLOBALS['xoopsOption']['template_main'] = 'jill_deid_index.tpl';
require_once XOOPS_ROOT_PATH . '/header.php';

// ponytail: Config::toJson()（§7）於 Phase 2 加入
$xoTheme->addStylesheet('modules/jill_deid/assets/css/jill-deid-app.css');
// 傳統 script，提供 globalThis.JSZip／fontkit／libphonenumber；須在 module script 之前
foreach (['jszip.min.js', 'fontkit.umd.min.js', 'libphonenumber-min.js'] as $js) {
    $xoTheme->addScript("modules/jill_deid/assets/vendor/{$js}");
}
$xoTheme->addScript('modules/jill_deid/assets/js/jill/main.js', ['type' => 'module']);

require_once XOOPS_ROOT_PATH . '/footer.php';
