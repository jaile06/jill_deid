<?php

use XoopsModules\Jill_deid\Tools;
if (!class_exists('XoopsModules\Jill_deid\Tools')) {
    require XOOPS_ROOT_PATH . '/modules/jill_deid/preloads/autoloader.php';
}
// tad_base（CKEditor 5 等）優先於 tadtools
if (!class_exists('XoopsModules\Tad_base\CkEditor5')) {
    require XOOPS_ROOT_PATH . '/modules/tad_base/preloads/autoloader.php';
}

Tools::get_session();
$interface_menu[_MD_JILLDEID_INDEX]="index.php";
$interface_icon[_MD_JILLDEID_INDEX]="fa-chevron-right";

