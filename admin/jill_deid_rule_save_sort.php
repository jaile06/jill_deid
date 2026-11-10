<?php
require_once __DIR__ . '/header.php';
//header.php 只到 mainfile，不會載 tadtools 的 main 語系，
//但底下的 _TAD_SORTED / _TAD_SORT_FAIL 在那裡面；PHP 8 未定義常數是 fatal。
xoops_loadLanguage('main', 'tadtools');
header('HTTP/1.1 200 OK');
$xoopsLogger->activated = false;
$sn = (int) $_POST['id'];
$sort = (int) $_POST['sort'];
$sql = "update `" . $xoopsDB->prefix("jill_deid_rule") . "` set `sort`='{$sort}' where `id`='{$sn}'";
$xoopsDB->exec($sql) or die(_TAD_SORT_FAIL . " (" . date("Y-m-d H:i:s") . ")");

echo _TAD_SORTED . " (" . date("Y-m-d H:i:s") . ")";;
