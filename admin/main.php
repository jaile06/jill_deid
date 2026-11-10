<?php

declare(strict_types=1);

use Xmf\Request;
use XoopsModules\Jill_deid\Preset;
use XoopsModules\Jill_deid\Rule;
use XoopsModules\Tadtools\Utility;

/*-----------引入檔案區--------------*/
$GLOBALS['xoopsOption']['template_main'] = 'jill_deid_admin.tpl';
require_once __DIR__ . '/header.php';

/*-----------變數過濾----------*/
$op = Request::getString('op', 'rule_index');
$id = Request::getInt('id');

// 寫入型 op 依序：POST → token → 模組管理員（spec §6.2）；不看 $_SESSION
$writes = ['rule_store', 'rule_update', 'rule_destroy', 'rule_toggle', 'rule_import_pack',
    'preset_store', 'preset_update', 'preset_destroy', 'preset_toggle'];
if (in_array($op, $writes, true)) {
    if ('POST' !== Request::getMethod()) {
        redirect_header('main.php', 3, _AM_JILLDEID_POST_ONLY);
    }
    Utility::xoops_security_check();
    if (!$xoopsUser || !$xoopsUser->isAdmin($xoopsModule->mid())) {
        redirect_header('main.php', 3, _NOPERM);
    }
}

/*-----------執行動作判斷區----------*/
switch ($op) {
    case 'rule_store':
    case 'rule_update':
        $errors = 'rule_store' === $op ? Rule::store() : Rule::update($id);
        if (!$errors) {
            header('Location: main.php?op=rule_index');
            exit;
        }
        Rule::create($id, Rule::posted(), $errors);
        $op = 'rule_form';
        break;

    case 'rule_destroy':
        Rule::destroy($id);
        header('Location: main.php?op=rule_index');
        exit;

    case 'rule_toggle':
        Rule::toggle($id);
        header('Location: main.php?op=rule_index');
        exit;

    case 'rule_import_pack':
        [$imported, $skipped] = Rule::import_pack();
        redirect_header('main.php?op=rule_index', 3, sprintf(_AM_JILLDEID_PACK_DONE, $imported, $skipped));

    case 'rule_create':
    case 'rule_edit':
        Rule::create($id);
        $op = 'rule_form';
        break;

    case 'preset_store':
    case 'preset_update':
        $errors = 'preset_store' === $op ? Preset::store() : Preset::update($id);
        if (!$errors) {
            header('Location: main.php?op=preset_index');
            exit;
        }
        Preset::create($id, Preset::posted(), $errors);
        $op = 'preset_form';
        break;

    case 'preset_destroy':
        Preset::destroy($id);
        header('Location: main.php?op=preset_index');
        exit;

    case 'preset_toggle':
        Preset::toggle($id);
        header('Location: main.php?op=preset_index');
        exit;

    case 'preset_create':
    case 'preset_edit':
        Preset::create($id);
        $op = 'preset_form';
        break;

    case 'preset_index':
        Preset::index();
        break;

    default:
        Rule::index();
        $op = 'rule_index';
        break;
}

/*-----------秀出結果區--------------*/
$xoopsTpl->assign('now_op', $op);
require_once __DIR__ . '/footer.php';
