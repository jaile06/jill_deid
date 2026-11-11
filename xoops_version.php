<?php

$modversion = [];

//---模組基本資訊---//
$modversion['name']        = _MI_JILLDEID_NAME;
$modversion['version']     = '1.0.0-Alpha';
$modversion['description'] = _MI_JILLDEID_DESC;
$modversion['author']      = 'tnjaile';
$modversion['credits']     = _MI_JILLDEID_CREDITS;
$modversion['license']     = 'GPL see LICENSE';
$modversion['image']       = 'images/logo.png';
$modversion['dirname']     = basename(__DIR__);

//---模組狀態資訊---//
$modversion['release_date']        = '2026-11-10';
$modversion['module_website_url']  = 'https://github.com/jaile06';
$modversion['module_website_name'] = _MI_JILLDEID_AUTHOR_WEB;
$modversion['module_status']       = 'alpha';
$modversion['author_website_url']  = 'https://github.com/jaile06';
$modversion['author_website_name'] = _MI_JILLDEID_AUTHOR_WEB;
$modversion['min_php']             = '8.3';
$modversion['min_xoops']           = '2.7.4';

//---安裝設定---//
$modversion['onInstall']   = 'include/onInstall.php';
$modversion['onUpdate']    = 'include/onUpdate.php';
$modversion['onUninstall'] = 'include/onUninstall.php';

//---資料表架構---//
$modversion['sqlfile']['mysql'] = 'sql/mysql.sql';
$modversion['tables']           = ['jill_deid_rule', 'jill_deid_preset'];

//---後台管理介面設定---//
$modversion['system_menu'] = 1;
$modversion['hasAdmin']    = 1;
$modversion['adminindex']  = 'admin/main.php';
$modversion['adminmenu']   = 'admin/menu.php';

//---前台主選單設定---//
$modversion['hasMain'] = 1;

//---樣板設定---//
$modversion['templates'] = [
    ['file' => 'jill_deid_index.tpl', 'description' => _MI_JILLDEID_TPL_INDEX],
    ['file' => 'jill_deid_admin.tpl', 'description' => _MI_JILLDEID_TPL_ADMIN],
];

//---偏好設定---//
$modversion['config'][] = [
    'name'        => 'column_labels',
    'title'       => '_MI_JILLDEID_COLUMN_LABELS',
    'description' => '_MI_JILLDEID_COLUMN_LABELS_DESC',
    'formtype'    => 'textarea',
    'valuetype'   => 'text',
    'default'     => _MI_JILLDEID_COLUMN_LABELS_DEFAULT,
];
