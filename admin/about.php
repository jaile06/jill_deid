<?php

declare(strict_types=1);

require __DIR__ . '/header.php';

$adminObject = \Xmf\Module\Admin::getInstance();
$adminObject->displayNavigation(basename(__FILE__));
$adminObject->displayAbout(false);

// moduleadmin 的關於頁不顯示 credits（只有系統的模組資訊看得到）：原作者與來源在這裡列出，網址做成連結
xoops_loadLanguage('modinfo', 'jill_deid');
$credits = preg_replace('#https?://[^\s<]+#', '<a href="$0" target="_blank" rel="noopener">$0</a>', nl2br(htmlspecialchars(_MI_JILLDEID_CREDITS, ENT_QUOTES)));
echo '<fieldset class="mt-3"><legend>' . htmlspecialchars(_MI_JILLDEID_CREDITS_TITLE, ENT_QUOTES) . '</legend><p>' . $credits . '</p></fieldset>';

require __DIR__ . '/footer.php';
