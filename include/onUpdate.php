<?php

declare(strict_types=1);

if (!class_exists('XoopsModules\Jill_deid\Update')) {
    require dirname(__DIR__) . '/preloads/autoloader.php';
}

function xoops_module_update_jill_deid(\XoopsModule $module, $old_version): bool
{
    // 升級步驟寫在 XoopsModules\Jill_deid\Update，例：if (Update::chk_1()) { Update::go_1(); }
    return true;
}
