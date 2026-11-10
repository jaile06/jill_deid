<?php


function xoops_module_uninstall_jill_deid($module)
{
    global $xoopsDB;
    $date = date("Ymd");

    rename(XOOPS_ROOT_PATH . "/uploads/jill_deid", XOOPS_ROOT_PATH . "/uploads/jill_deid_bak_{$date}");

    return true;
}
