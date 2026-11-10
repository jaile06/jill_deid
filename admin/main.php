<?php
use Xmf\Request;
use XoopsModules\Tadtools\CategoryHelper;
use XoopsModules\Tadtools\SweetAlert;
use XoopsModules\Tadtools\Utility;
use XoopsModules\Tadtools\Ztree;
use XoopsModules\Jill_deid\Tools;
use XoopsModules\Jill_deid\Jill_deid_preset;
use XoopsModules\Tadtools\FormValidator;
use XoopsModules\Jill_deid\Jill_deid_rule;
use XoopsModules\Tadtools\TadUpFiles;


/*-----------引入檔案區--------------*/
$GLOBALS['xoopsOption']['template_main'] = 'jill_deid_admin.tpl';
require_once __DIR__ . '/header.php';
$_SESSION['jill_deid_adm'] = true;

/*-----------變數過濾----------*/
// op 會被樣板組成 op_{op}.tpl 再 include，只留資料表名稱可用的字元，杜絕 ../ 跳出 templates/
$op = preg_replace('/[^a-zA-Z0-9_]/', '', Request::getString('op'));
$id = Request::getInt('id');


/*-----------執行動作判斷區----------*/
switch($op){
    
    //更新排序
    case 'update_jill_deid_rule_sort':
        $msg = update_jill_deid_rule_sort();
        die($msg);

    //輸入表格
    case 'jill_deid_preset_create':
        Jill_deid_rule::list_tree($id);
        Jill_deid_preset::create($id, $id);
        break;

    //輸入表格
    case 'jill_deid_preset_edit':
        Jill_deid_rule::list_tree($id);
        Jill_deid_preset::create($id, $id);
        $op = 'jill_deid_preset_create';
        break;

    //刪除資料
    case 'jill_deid_preset_destroy':
        Jill_deid_preset::destroy($id);
        header("location: {$_SERVER['SCRIPT_NAME']}");
        exit;

    
    case 'jill_deid_rule_create':
        Jill_deid_rule::list_tree($id);
        Jill_deid_rule::create();
        break;

    
    case 'jill_deid_rule_edit':
        Jill_deid_rule::list_tree($id);
        Jill_deid_rule::create($id);
        $op = 'jill_deid_rule_create';
        break;

    
    case 'jill_deid_rule_destroy':
        Jill_deid_rule::destroy($id);
        header("location: {$_SERVER['SCRIPT_NAME']}");
        exit;

    
    case 'jill_deid_rule_list_tree':
        Jill_deid_rule::list_tree($id);
        Jill_deid_preset::index($id);
        break;

    
    case 'jill_deid_preset_list':
        Jill_deid_rule::list_tree($id);
        Jill_deid_preset::index($id);
        break;

    //新增資料
    case 'jill_deid_rule_store':
        $id = Jill_deid_rule::store();
        header("location: {$_SERVER['SCRIPT_NAME']}?id=$id");
        exit;

    //更新資料
    case 'jill_deid_rule_update':
        $where_arr['id'] = $id;
        Jill_deid_rule::update($where_arr);
        header("location: {$_SERVER['SCRIPT_NAME']}?id=$id");
        exit;

    //預設動作
    default:
        Jill_deid_rule::list_tree($id);
        Jill_deid_preset::index($id);
        $op = "jill_deid_rule_list_tree";
        break;
}

/*-----------秀出結果區--------------*/
// 沒有對應樣板的 op（亂打的網址）不交給樣板 include，否則 Smarty 找不到檔案會直接拋例外
$xoopsTpl->assign('now_op', is_file(dirname(__DIR__) . "/templates/op_{$op}.tpl") ? $op : '');
require_once __DIR__ . '/footer.php';


/*-----------功能函數區----------*/

