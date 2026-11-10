<?php

declare(strict_types=1);

use XoopsModules\Jill_deid\Config;

require_once __DIR__ . '/header.php';

// 佈景含行內腳本，無法套嚴格 CSP；只送 Referrer-Policy，避免連結帶出本頁網址
header('Referrer-Policy: no-referrer');

$GLOBALS['xoopsOption']['template_main'] = 'jill_deid_index.tpl';
require_once XOOPS_ROOT_PATH . '/header.php';

// 佈景的 Google 翻譯會把整頁（含預覽中的個資）送到 Google，本頁拿掉（spec §0 INV-1）。
// school2022 等佈景把它當成任一區域的內容項目 'google_translate'，由 TadTools 指派成樣板變數。
foreach ($xoopsTpl->getTemplateVars() as $name => $value) {
    if (is_array($value) && in_array('google_translate', $value, true)) {
        $xoopsTpl->assign($name, array_values(array_diff($value, ['google_translate'])));
    }
}

$xoopsTpl->assign('deid_config_json', Config::toJson());
// upstream.css 由轉換工具產生（限定在 #jill-deid-app 內）；jill_deid.css 補佈景 Bootstrap 的同名 class
$xoTheme->addStylesheet('modules/jill_deid/assets/css/upstream.css');
$xoTheme->addStylesheet('modules/jill_deid/assets/css/jill_deid.css');
// vendor 由用到的模組自行 import（spec §4），這裡不載入
$xoTheme->addScript('modules/jill_deid/assets/js/jill/main.js', ['type' => 'module']);

require_once XOOPS_ROOT_PATH . '/footer.php';
