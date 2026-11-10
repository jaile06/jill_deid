<?php
use Xmf\Request;
use XoopsModules\Tadtools\FormValidator;
use XoopsModules\Jill_deid\Tools;
use XoopsModules\Jill_deid\Jill_deid_preset;
use XoopsModules\Tadtools\Utility;
use XoopsModules\Tadtools\TadUpFiles;
use XoopsModules\Tadtools\SweetAlert;
use XoopsModules\Tadtools\BootstrapTable;
use XoopsModules\Tadtools\FancyBox;


/*-----------引入檔案區--------------*/
require_once __DIR__ . '/header.php';
$GLOBALS['xoopsOption']['template_main'] = 'jill_deid_index.tpl';
require_once XOOPS_ROOT_PATH . '/header.php';

/*-----------變數過濾----------*/
// op 會被樣板組成 op_{op}.tpl 再 include，只留資料表名稱可用的字元，杜絕 ../ 跳出 templates/
$op = preg_replace('/[^a-zA-Z0-9_]/', '', Request::getString('op'));
$id = Request::getInt('id');


/*-----------執行動作判斷區----------*/
switch($op){
    
    //新增資料
    case 'jill_deid_preset_store':
        $id = Jill_deid_preset::store();
        header("location: {$_SERVER['SCRIPT_NAME']}?id=$id");
        exit;

    //更新資料
    case 'jill_deid_preset_update':
        $where_arr['id'] = $id;
        Jill_deid_preset::update($where_arr);
        header("location: {$_SERVER['SCRIPT_NAME']}?id=$id");
        exit;

    //新增用表單
    case 'jill_deid_preset_create':
        Jill_deid_preset::create();
        break;

    //修改用表單
    case 'jill_deid_preset_edit':
        Jill_deid_preset::create($id);
        $op = 'jill_deid_preset_create';
        break;

    //刪除資料
    case 'jill_deid_preset_destroy':
        Jill_deid_preset::destroy($id);
        header("location: {$_SERVER['SCRIPT_NAME']}");
        exit;

    //列出所資料
    case 'jill_deid_preset_index':
        $where_arr['enable'] = '1';
        Jill_deid_preset::index($where_arr, [], [], ['sort' => 'asc']);
        break;

    //顯示某筆資料
    case 'jill_deid_preset_show':
        $where_arr['id'] = $id;
        Jill_deid_preset::show($where_arr);
        break;

    //預設動作
    default:
        if(empty($id)) {
            $where_arr['enable'] = '1';
            Jill_deid_preset::index($where_arr);
            $op = 'jill_deid_preset_index';
        }else{
            $where_arr['id'] = $id;
            Jill_deid_preset::show($where_arr);
            $op = 'jill_deid_preset_show';
        }
        break;
}

/*-----------秀出結果區--------------*/
$xoopsTpl->assign('toolbar' , Utility::toolbar_bootstrap($interface_menu, false, $interface_icon));
// 沒有對應樣板的 op（亂打的網址）不交給樣板 include，否則 Smarty 找不到檔案會直接拋例外
$xoopsTpl->assign('now_op', is_file(__DIR__ . "/templates/op_{$op}.tpl") ? $op : '');
// 以模組版本號當快取索引：升版才換 URL，平時瀏覽器可正常快取
// （原本用 time()，每次請求 URL 都不同，等於永遠無法快取）
$css_ver = $xoopsModule ? $xoopsModule->getVar('version') : 0;
$xoTheme->addStylesheet("modules/jill_deid/css/module.css?t={$css_ver}");
$xoTheme->addStylesheet("modules/tadtools/css/vtb.css?t={$css_ver}");
require_once XOOPS_ROOT_PATH . '/footer.php';

/*-----------功能函數區----------*/

