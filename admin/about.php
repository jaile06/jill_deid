<?php


require __DIR__ . '/header.php';
//xoops_cp_header();

$adminObject = \Xmf\Module\Admin::getInstance();

$adminObject->displayNavigation(basename(__FILE__));
$adminObject::setPaypal('xoopsfoundation@gmail.com');
$adminObject->displayAbout(false);

require __DIR__ . '/footer.php';
