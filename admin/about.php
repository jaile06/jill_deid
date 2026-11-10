<?php

declare(strict_types=1);

require __DIR__ . '/header.php';

$adminObject = \Xmf\Module\Admin::getInstance();
$adminObject->displayNavigation(basename(__FILE__));
$adminObject->displayAbout(false);

require __DIR__ . '/footer.php';
