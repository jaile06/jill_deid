<?php


require_once dirname(dirname(dirname(__DIR__))) . '/include/cp_header.php';
require_once XOOPS_ROOT_PATH . '/modules/' . $xoopsModule->getVar('dirname') . '/preloads/autoloader.php';
require_once XOOPS_ROOT_PATH . '/modules/tad_base/preloads/autoloader.php';
require_once XOOPS_ROOT_PATH . '/modules/tadtools/preloads/autoloader.php';

xoops_loadLanguage('main', $xoopsModule->getVar('dirname'));

if (!isset($xoopsTpl) || !is_object($xoopsTpl)) {
    require_once XOOPS_ROOT_PATH . '/class/template.php';
    $xoopsTpl = new \XoopsTpl();
}

xoops_cp_header();

// Define Stylesheet and JScript
$xoTheme->addStylesheet(XOOPS_URL . '/modules/tadtools/css/iconize.css');
// 產出樣板使用 Font Awesome 6 圖示名稱（fa-floppy-disk 等），舊版 FA4 顯示不出來
$xoTheme->addStylesheet(XOOPS_URL . '/modules/tad_base/packages/fontawesome6/css/all.min.css');
$xoTheme->addStylesheet(XOOPS_URL . "/modules/tadtools/css/xoops_adm{$_SESSION['bootstrap']}.css");
// 以模組版本號當快取索引：升版才換 URL，平時瀏覽器可正常快取
// （原本用 time()，每次請求 URL 都不同，等於永遠無法快取）
$css_ver = $xoopsModule->getVar('version');
$xoTheme->addStylesheet(XOOPS_URL . '/modules/' . $xoopsModule->getVar('dirname') . "/css/module.css?t={$css_ver}");
$xoTheme->addStylesheet(XOOPS_URL . '/modules/' . $xoopsModule->getVar('dirname') . "/css/admin.css?t={$css_ver}");
