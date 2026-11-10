<?php

declare(strict_types=1);

// 本模組不寫 uploads/（規格 §0），安裝時無需建目錄
function xoops_module_install_jill_deid(\XoopsModule $module): bool
{
    return true;
}
