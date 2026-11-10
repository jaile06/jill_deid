<?php


$modversion = [];

//---模組基本資訊---//
$modversion['name']        = _MI_JILLDEID_NAME;
$modversion['version']     = '1.0.0-Stable';
$modversion['description'] = _MI_JILLDEID_DESC;
$modversion['author']      = _MI_JILLDEID_AUTHOR;
$modversion['credits']     = _MI_JILLDEID_CREDITS;
$modversion['help']        = 'page=help';
$modversion['license']     = 'GPL see LICENSE';
$modversion['image']       = "images/logo.png";
$modversion['dirname']     = basename(__DIR__);

//---模組狀態資訊---//
$modversion['release_date']        = '2026-11-17';
$modversion['module_website_url']  = 'https://github.com/jaile06';
$modversion['module_website_name'] = _MI_JILLDEID_AUTHOR_WEB;
$modversion['module_status']       = 'release';
$modversion['author_website_url']  = 'https://github.com/jaile06';
$modversion['author_website_name'] = _MI_JILLDEID_AUTHOR_WEB;
$modversion['min_php']             = '8.2';
$modversion['min_xoops']           = '2.7.4';

//---paypal資訊---//
$modversion['paypal'] = [
    'business' => 'tad0616@gmail.com',
    'item_name' => 'Donation : ' . _MI_JILLDEID_AUTHOR,
    'amount' => 0,
    'currency_code' => 'USD',
];

//---安裝設定---//
$modversion['onInstall']   = "include/onInstall.php";
$modversion['onUpdate']    = "include/onUpdate.php";
$modversion['onUninstall'] = "include/onUninstall.php";



//---資料表架構---//
$modversion['sqlfile']['mysql'] = "sql/mysql.sql";
$modversion['tables'] = ['jill_deid_preset', 'jill_deid_rule'];


//---後台使用系統選單---//
$modversion['system_menu'] = 1;

//---後台管理介面設定---//
$modversion['hasAdmin']   = 1;
$modversion['adminindex'] = 'admin/main.php';
$modversion['adminmenu']  = 'admin/menu.php';

//---前台主選單設定---//
$modversion['hasMain'] = 1;
$modversion['sub'][] = [
    ['name' => _MI_JILLDEID_INDEX, 'url'=> 'index.php'],
];


//---樣板設定---//
$modversion['templates'] = [
    ['file' => 'jill_deid_admin.tpl', 'description' => 'jill_deid_admin.tpl'],
    ['file' => 'jill_deid_index.tpl', 'description' => 'jill_deid_index.tpl'],
];


//---區塊設定---//
$modversion['blocks'] = [
];

