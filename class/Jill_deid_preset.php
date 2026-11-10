<?php
namespace XoopsModules\Jill_deid;

use XoopsModules\Tadtools\SweetAlert;
use XoopsModules\Tadtools\Utility;
use XoopsModules\Tadtools\BootstrapTable;
use XoopsModules\Tadtools\FancyBox;
use XoopsModules\Jill_deid\Tools;
use XoopsModules\Tadtools\TadUpFiles;
use XoopsModules\Tadtools\FormValidator;



class Jill_deid_preset
{
    // 過濾用變數的設定
    public static $filter_arr = [
        'int' => ['id','sort'],   //數字類的欄位
        'html' => [], //含網頁語法的欄位（所見即所得的內容）
        'text' => [], //純大量文字欄位
        'json' => ['custom_config'], //內容為 json 格式的欄位
        'pass' => ['files'], //不予過濾的欄位
        'explode' => [],   //用分號隔開的欄位
    ];

    //列出所有 jill_deid_preset 資料 Jill_deid_preset::index()
    public static function index($where_arr = [], $other_arr = [], $view_cols = [], $order_arr = [], $amount = '')
    {
        global $xoopsTpl, $xoTheme;

        if ($amount) {
            list($all_jill_deid_preset, $total, $bar) = self::get_all($where_arr, $other_arr, $view_cols, $order_arr, null, null, 'read', $amount);
            $xoopsTpl->assign('bar', $bar);
            $xoopsTpl->assign('total', $total);
        } else {
            $all_jill_deid_preset = self::get_all($where_arr, $other_arr, $view_cols, $order_arr);
        }

        $xoopsTpl->assign('all_jill_deid_preset', $all_jill_deid_preset);
        Utility::test($all_jill_deid_preset, 'all_jill_deid_preset');

        //刪除確認的JS
        $SweetAlert   = new SweetAlert();
        $SweetAlert->render('jill_deid_preset_destroy_func', Tools::destroy_url("op=jill_deid_preset_destroy&id="), "id");
        
        Utility::get_jquery(true);
        BootstrapTable::render();

        $fancybox = new FancyBox('.fancybox_jill_deid_preset_id');
        $fancybox->render();
    }


    //取得 jill_deid_preset 所有資料陣列 Jill_deid_preset::get_all()
    public static function get_all($where_arr = [], $other_arr = [], $view_cols = [], $order_arr = [], $key_name = false, $get_value = '', $filter = 'read', $amount = '')
    {
        global $xoopsDB;

        $and_sql = Tools::get_and_where($where_arr);
        $view_col = Tools::get_view_col($view_cols);
        $order_sql = Tools::get_order($order_arr);
        $order = $amount ? '' : $order_sql;

        $sql = "SELECT {$view_col} FROM `" . $xoopsDB->prefix("jill_deid_preset") . "` WHERE 1 {$and_sql} {$order}";

        // Utility::getPageBar($原sql語法, 每頁顯示幾筆資料, 最多顯示幾個頁數選項);
        if ($amount) {
            $PageBar = Utility::getPageBar($sql, $amount, 10, '', '', $_SESSION['bootstrap'], 'g2p', $order_sql);
            $bar = $PageBar['bar'];
            $sql = $PageBar['sql'];
            $total = $PageBar['total'];
        }

        $result = $xoopsDB->query($sql) or Utility::web_error($sql);
        $data_arr = [];
        $i = 0;
        
        while ($data = $xoopsDB->fetchArray($result)) {
            
            $data = Tools::filter_all_data($filter, $data, self::$filter_arr);

            foreach (self::$filter_arr['explode'] as $item) {
                $data[$item . '_arr'] = explode(';', $data[$item]);
            }

            // if (in_array('xxx', $other_arr) || in_array('all', $other_arr)) {
            //     $data['xxx'] = ooo::get_all();
            // }
            

            $new_key = $key_name ? $data[$key_name] : $i;
            $data_arr[$new_key] = $get_value ? $data[$get_value] : $data;
            $i++;
        }

        if ($amount) {
            return [$data_arr, $total, $bar];
        }else{
            return $data_arr;
        }
    }


    //以流水號秀出某筆 jill_deid_preset 資料內容 Jill_deid_preset::show()
    public static function show($where_arr = [], $other_arr = [], $mode = '')
    {
        global $xoopsTpl;

        if (empty($where_arr)) {
            redirect_header($_SERVER['HTTP_REFERER'], 3, "無查詢條件：" . __FILE__ . __LINE__);
        }

        $all = self::get($where_arr, $other_arr);
        if (empty($all)) {
            return false;
        }

        foreach ($all as $key => $value) {
            $value = Tools::filter($key, $value, 'read', self::$filter_arr);
            $all[$key] = $value;
            $$key = $value;
        }

        

        $SweetAlert   = new SweetAlert();
        $SweetAlert->render('jill_deid_preset_destroy_func', Tools::destroy_url("op=jill_deid_preset_destroy&id="), "id");

        if ($mode == "return") {
            return $all;
        } elseif ($mode == "assign_all") {
            $xoopsTpl->assign('jill_deid_preset', $all);
        } else {
            foreach ($all as $key => $value) {
                $xoopsTpl->assign($key, $value);
            }
        }
    }


    //以流水號取得某筆 jill_deid_preset 資料 Jill_deid_preset::get()
    public static function get($where_arr = [], $other_arr = [], $filter = 'read', $only_key = '')
    {
        global $xoopsDB;

        if (empty($where_arr)) {
            redirect_header($_SERVER['HTTP_REFERER'], 3, "無查詢條件：" . __FILE__ . __LINE__);
        }

        $and_sql = Tools::get_and_where($where_arr);

        $sql = "SELECT * FROM `" . $xoopsDB->prefix("jill_deid_preset") . "` WHERE 1 $and_sql";
        $result = $xoopsDB->query($sql) or Utility::web_error($sql);
        $data = $xoopsDB->fetchArray($result);
        $data = Tools::filter_all_data($filter, $data, self::$filter_arr);
        

        // if (in_array('xxx', $other_arr) || in_array('all', $other_arr)) {
        //     $data['xxx'] = ooo::get_all();
        // }

        foreach (self::$filter_arr['explode'] as $item) {
            $data[$item . '_arr'] = explode(';', $data[$item]);
        }

        if ($only_key) {
            return $data[$only_key];
        } else {
            return $data;
        }
    }


    //jill_deid_preset 編輯表單
    public static function create($id = '' )
    {
        global $xoopsTpl, $xoopsUser;
        Tools::chk_permission();

        //抓取預設值
        $jill_deid_preset = (!empty($id)) ? self::get(['id' =>$id]) : [];

        //預設值設定
        
        $def['id'] = $id;
        $def['keep_strategy'] = 'partial';
        $def['marker_style'] = 'code';
        $def['hyperlink_mode'] = 'mask_pii_in_url';
        $def['is_default'] = '0';
        $def['enable'] = '1';
        $def['sort'] = self::max_sort();

        if (empty($jill_deid_preset)) {
            $jill_deid_preset = $def;
        }

        foreach ($jill_deid_preset as $key => $value) {
            $value = Tools::filter($key, $value, 'edit', self::$filter_arr);
            $$key = isset($jill_deid_preset[$key]) ? $jill_deid_preset[$key] : $def[$key];
            $xoopsTpl->assign($key, $value);
        }

        $op = (!empty($id)) ? "jill_deid_preset_update" : "jill_deid_preset_store";
        $xoopsTpl->assign('next_op', $op);

        //套用formValidator驗證機制
        $formValidator = new FormValidator("#myForm", true);
        $formValidator->render();

        
    
        //加入Token安全機制
        Utility::token_form();
    }


    //新增資料到 jill_deid_preset Jill_deid_preset::store()
    public static function store($data_arr = [])
    {
        global $xoopsDB, $xoopsUser;
        Tools::chk_permission();

        //XOOPS表單安全檢查
        if (empty($data_arr)) {
            Utility::xoops_security_check();
            $data_arr = $_POST;
        }

        foreach ($data_arr as $key => $value) {
            $$key = Tools::filter($key, $value, 'write', self::$filter_arr);
        }

        

        $sql = "INSERT INTO `" . $xoopsDB->prefix("jill_deid_preset") . "` (
            `title`, 
            `description`, 
            `keep_strategy`, 
            `marker_style`, 
            `hyperlink_mode`, 
            `custom_config`, 
            `is_default`, 
            `enable`, 
            `sort`
        ) VALUES(
            '{$title}', 
            '{$description}', 
            '{$keep_strategy}', 
            '{$marker_style}', 
            '{$hyperlink_mode}', 
            '{$custom_config}', 
            '{$is_default}', 
            '{$enable}', 
            '{$sort}'
        )";
        $xoopsDB->exec($sql) or Utility::web_error($sql);

        //取得最後新增資料的流水編號
        $id = $xoopsDB->getInsertId();
        
        return $id;
    }


    //更新 jill_deid_preset 某一筆資料 Jill_deid_preset::update()
    public static function update($where_arr=[], $data_arr = [])
    {
        global $xoopsDB, $xoopsUser;
        Tools::chk_permission();

        $and = Tools::get_and_where($where_arr);

        if (!empty($data_arr)) {
            $col_arr = [];

            foreach ($data_arr as $key => $value) {
                $value = Tools::filter($key, $value, 'write', self::$filter_arr);
                $col_arr[] = "`$key` = '{$value}'";
            }
            $update_cols = implode(', ', $col_arr);
            $sql = "UPDATE `" . $xoopsDB->prefix("jill_deid_preset") . "` SET
            $update_cols WHERE 1 $and";
        } else {
            //XOOPS表單安全檢查
            Utility::xoops_security_check(__FILE__, __LINE__);

            foreach ($_POST as $key => $value) {
                $$key = Tools::filter($key, $value, 'write', self::$filter_arr);
            }
            

            $sql = "UPDATE `" . $xoopsDB->prefix("jill_deid_preset") . "` SET 
            `title` = '{$title}', 
            `description` = '{$description}', 
            `keep_strategy` = '{$keep_strategy}', 
            `marker_style` = '{$marker_style}', 
            `hyperlink_mode` = '{$hyperlink_mode}', 
            `custom_config` = '{$custom_config}', 
            `is_default` = '{$is_default}', 
            `enable` = '{$enable}', 
            `sort` = '{$sort}'
            WHERE 1 $and";
        }
        $xoopsDB->exec($sql) or Utility::web_error($sql);
        
        return $where_arr['id'];
    }


    //刪除 jill_deid_preset 某筆資料資料 Jill_deid_preset::destroy()
    public static function destroy($id = '')
    {
        global $xoopsDB;
        Tools::chk_permission();
        Utility::xoops_security_check();

        if(empty($id)) {
            return;
        }

        $and = '';
        if($id){
        $and .= "and `id` = '" . $xoopsDB->escape($id) . "'";
    }
    

        $sql = "DELETE FROM `" . $xoopsDB->prefix("jill_deid_preset") . "`
        WHERE 1 $and";
        $xoopsDB->exec($sql) or Utility::web_error($sql);
        
    }




    //自動取得 jill_deid_preset 的最新排序 Jill_deid_preset::get_max()
    public static function max_sort()
    {
        global $xoopsDB;
        $sql = "select max(`sort`) from `" . $xoopsDB->prefix("jill_deid_preset") . "`";
        $result = $xoopsDB->query($sql) or Utility::web_error($sql);
        [$sort] = $xoopsDB->fetchRow($result) ?: [null];
        return ++$sort;
    }

}
