<?php


defined('XOOPS_ROOT_PATH') || die('Restricted access.');

/**
 * Class Jill_deidCorePreload
 */
class Jill_deidCorePreload extends XoopsPreloadItem
{
    // to add PSR-4 autoloader

    /**
     * @param $args
     */
    public static function eventCoreIncludeCommonEnd($args)
    {
        require __DIR__ . '/autoloader.php';
    }
}
