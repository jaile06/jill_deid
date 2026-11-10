<?php

declare(strict_types=1);

// 資料表由核心依 $modversion['tables'] 移除；本模組沒有 uploads/ 要處理
function xoops_module_uninstall_jill_deid(\XoopsModule $module): bool
{
    return true;
}
