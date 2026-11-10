<?php

declare(strict_types=1);

// ponytail: preloads/core.php 已在核心載入時註冊 autoloader，這裡只防 preload 快取未更新的情況
if (!class_exists('XoopsModules\Jill_deid\Tools')) {
    require __DIR__ . '/preloads/autoloader.php';
}
