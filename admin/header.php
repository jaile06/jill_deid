<?php

declare(strict_types=1);

require_once dirname(__DIR__, 3) . '/include/cp_header.php';
require_once XOOPS_ROOT_PATH . '/modules/tadtools/preloads/autoloader.php';

xoops_loadLanguage('main', $xoopsModule->getVar('dirname'));

xoops_cp_header();

$xoTheme->addStylesheet(XOOPS_URL . '/modules/tadtools/css/iconize.css');
$xoTheme->addStylesheet(XOOPS_URL . '/modules/tad_base/packages/fontawesome6/css/all.min.css');
$xoTheme->addStylesheet(XOOPS_URL . '/modules/tadtools/css/xoops_adm' . ($_SESSION['bootstrap'] ?? '5') . '.css');
$xoTheme->addStylesheet(XOOPS_URL . '/modules/jill_deid/css/admin.css?t=' . $xoopsModule->getVar('version'));
