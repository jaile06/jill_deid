<?php

declare(strict_types=1);

defined('XOOPS_ROOT_PATH') || die('Restricted access.');

class Jill_deidCorePreload extends \XoopsPreloadItem
{
    public static function eventCoreIncludeCommonEnd($args): void
    {
        require __DIR__ . '/autoloader.php';
    }
}
