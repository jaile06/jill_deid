<?php

declare(strict_types=1);

/*-----------引入檔案區--------------*/
$GLOBALS['xoopsOption']['template_main'] = 'jill_deid_admin.tpl';
require_once __DIR__ . '/header.php';

// ponytail: Phase 1a 只有外框；rule_*、preset_* 的 switch($op) 於 Phase 2 依規格 §6.2 加入

/*-----------秀出結果區--------------*/
require_once __DIR__ . '/footer.php';
