<?php
use XoopsModules\Tadtools\Utility;

require_once __DIR__ . '/header.php';
//header.php 只到 mainfile，不會載 tadtools 的 admin_common 語系，
//但底下的 _MA_TREETABLE_MOVE_* 在那裡面；PHP 8 未定義常數是 fatal。
xoops_loadLanguage('admin_common', 'tadtools');
header('HTTP/1.1 200 OK');
$xoopsLogger->activated = false;
$of_sn = (int) str_replace("node-_", "", $_POST['']);
$sn = (int) str_replace("node-_", "", $_POST['id']);

if ($of_sn == $sn) {
    die(_MA_TREETABLE_MOVE_ERROR1 . "(" . date("Y-m-d H:i:s") . ")");
} elseif (chk_cate_path($sn, $of_sn)) {
    die(_MA_TREETABLE_MOVE_ERROR2 . "(" . date("Y-m-d H:i:s") . ")");
}

$sql = "update " . $xoopsDB->prefix("jill_deid_rule") . " set ``='{$of_sn}' where `id`='{$sn}'";
$xoopsDB->exec($sql) or die("Reset Fail! (" . date("Y-m-d H:i:s") . ")");

echo _MA_TREETABLE_MOVE_OK . " (" . date("Y-m-d H:i:s") . ")";

//檢查目的地編號是否在其子目錄下
function chk_cate_path($sn, $to_sn)
{
    global $xoopsDB;
    //抓出子目錄的編號
    $sql = "select `id` from " . $xoopsDB->prefix("jill_deid_rule") . " where ``='{$sn}'";
    $result = $xoopsDB->query($sql) or Utility::web_error($sql);
    while ($db_row = $xoopsDB->fetchRow($result)) {
        [$sub_sn] = $db_row;
        if (chk_cate_path($sub_sn, $to_sn)) {
            return true;
        }
        if ($sub_sn == $to_sn) {
            return true;
        }
    }

    return false;
}
