<?php

declare(strict_types=1);

// PSR-4：XoopsModules\Jill_deid\Foo → class/Foo.php
spl_autoload_register(static function (string $class): void {
    $prefix = 'XoopsModules\\Jill_deid\\';
    if (!str_starts_with($class, $prefix)) {
        return;
    }
    $file = dirname(__DIR__) . '/class/' . str_replace('\\', '/', substr($class, strlen($prefix))) . '.php';
    if (is_file($file)) {
        require $file;
    }
});
