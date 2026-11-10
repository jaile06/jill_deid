<?php
namespace XoopsModules\Jill_deid;

use Xmf\Request;
use XoopsModules\Tadtools\Wcag;



/**
 * Class Tools
 */
class Tools
{
    // 變數過濾
    public static function filter($key, $value, $mode = "read", $filter_arr = [])
    {
        global $xoopsDB;
        $myts = \MyTextSanitizer::getInstance();

        if (isset($filter_arr['pass']) && in_array($key, $filter_arr['pass'])) {
            return $value;
        }

        if ($mode == 'write' && in_array($key, $filter_arr['json'])) {
            $value = json_encode($value, 256);
        }

        if (is_array($value)) {
            foreach ($value as $k => $v) {
                if (isset($filter_arr['json']) and is_array($filter_arr['json']) and in_array($key, $filter_arr['json'])) {
                    $v = self::filter($k, $v, $mode, $filter_arr);
                } else {
                    $v = self::filter($key, $v, $mode, $filter_arr);
                }
                $value[$k] = $v;
            }
        } else {
            if (isset($filter_arr['int']) && in_array($key, $filter_arr['int'], true)) {
                $value = (int) $value;
            } elseif (isset($filter_arr['html']) && in_array($key, $filter_arr['html'], true)) {
                if ($mode == 'edit') {
                    $value = $myts->htmlSpecialChars($value);
                } else {
                    $value = ($mode == 'write') ? $xoopsDB->escape(Wcag::amend(trim($value))) : $myts->displayTarea($value, 1, 1, 1, 1, 0);
                }
            } elseif (isset($filter_arr['text']) && in_array($key, $filter_arr['text'], true)) {
                if ($mode == 'edit') {
                    $value = $myts->htmlSpecialChars($value);
                } else {
                    $value = ($mode == 'write') ? $xoopsDB->escape(trim($value)) : $myts->displayTarea($value, 0, 0, 0, 1, 1);
                }
            } elseif (isset($filter_arr['json']) && in_array($key, $filter_arr['json'], true)) {

                if ($mode == 'write') {
                    $value = $xoopsDB->escape(trim($value));
                } else {
                    $value = json_decode($value, true);
                    foreach ($value as $k => $v) {
                        $value[$k] = self::filter($k, $v, $mode);
                    }
                }

            } elseif (!isset($filter_arr['pass']) || !in_array($key, $filter_arr['pass'], true)) {
                if ($mode == 'edit') {
                    $value = $myts->htmlSpecialChars($value);
                } else {
                    $value = ($mode == 'write') ? $xoopsDB->escape(trim($value)) : $myts->htmlSpecialChars($value);
                }
            }
        }

        return $value;
    }


    // 取得資料庫條件
    public static function get_and_where($where_arr = '', $prefix = '')
    {
        global $xoopsDB;
        if (is_array($where_arr)) {
            $and_where_arr = '';
            foreach ($where_arr as $col => $value) {
                if (!is_string($col)) {
                    continue; // 避免非字串 key 的 SQL 注入
                }
                $and_where_arr .= " and {$prefix}`{$col}` = '" . $xoopsDB->escape($value) . "'";
            }
        } else {
            $and_where_arr = $where_arr;
        }
        return $and_where_arr;
    }

    /**
     * 刪除用的 GET 連結：自帶一次性 token，且不用 $_SERVER['PHP_SELF']
     * PHP_SELF = SCRIPT_NAME + PATH_INFO，攻擊者可用 index.php/'+alert(1)+' 塞東西進來，
     * 而 SweetAlert 是把網址原樣寫進 JS 字串，等於反射型 XSS。
     * SCRIPT_NAME 由伺服器決定、不含 path-info，是同樣好用但安全的來源。
     */
    public static function destroy_url(string $query): string
    {
        $token = $GLOBALS['xoopsSecurity']->createToken();
        return htmlspecialchars($_SERVER['SCRIPT_NAME'], ENT_QUOTES) . "?XOOPS_TOKEN_REQUEST={$token}&{$query}";
    }

    // 取得資料庫顯示欄位
    public static function get_view_col($view_cols = [], $prefix = '')
    {
        if (empty($view_cols)) {
            $view_col = $prefix . '*';
        } elseif (is_array($view_cols)) {
            $view_col = $prefix . '`' . implode("`, `{$prefix}", $view_cols) . '`';
        } else {
            $view_col = $view_cols;
        }
        return $view_col;
    }

    // 取得資料庫排序條件
    public static function get_order($order_arr = [], $prefix = '')
    {
        $before_sql = $order_sql = $after_sql = '';
        $before_items = $order_items = $after_items = [];
        if ($order_arr) {
            foreach ($order_arr as $col => $asc) {
                if ($col === 'before order') {
                    $before_items[] = $asc;
                } elseif ($col === 'after order') {
                    $after_items[] = $asc;
                } elseif (!is_string($col) or empty($col)) {
                    $order_items[] = $asc;
                } else {
                    $order_items[] = "{$prefix}`{$col}` $asc";
                }
            }

            $before_sql = empty($before_items) ? '' : implode(',', $before_items);
            $order_sql = empty($order_items) ? '' : "ORDER BY " . implode(',', $order_items);
            $after_sql = empty($after_items) ? '' : implode(',', $after_items);
        }
        return "$before_sql $order_sql $after_sql";
    }

    // 過濾所有資料
    public static function filter_all_data($filter, $data, $filter_arr)
    {
        if ($filter) {
            foreach ($data as $key => $value) {
                $data[$key] = self::filter($key, $value, $filter, $filter_arr);
            }
        }
        return $data;
    }

    //檢查當前使用者是否為本模組管理者（讀 session，由 get_session() 寫入）
    public static function isAdmin(): bool
    {
        return !empty($_SESSION['jill_deid_adm']);
    }

    /**
     * 統一權限守門：管理員直接放行，或比對資料擁有者 uid
     *
     * @param int    $owner_uid 資料擁有者 uid（0 = 純管理員檢查）
     * @param string $mode      'return' = 無權限時回傳 false 而非 redirect
     * @return bool
     */
    public static function chk_permission(int $owner_uid = 0, string $mode = ''): bool
    {
        // 管理員直接放行
        if (self::isAdmin()) {
            return true;
        }

        // 比對資料擁有者
        if ($owner_uid > 0) {
            global $xoopsUser;
            $now_uid = ($xoopsUser) ? (int) $xoopsUser->uid() : 0;
            if ($now_uid && $now_uid === $owner_uid) {
                return true;
            }
        }

        if ($mode === 'return') {
            return false;
        }
        redirect_header(XOOPS_URL . '/modules/jill_deid/index.php', 3, defined('_NOPERM') ? _NOPERM : '無操作權限');
    }

    //取得session
    public static function get_session()
    {
        global $xoopsUser;

        //判斷是否對該模組有管理權限
        //每次請求重算，不快取在 session：快取會讓登入前算出的 false（或降權前的 true）延續整個 session
        $_SESSION['jill_deid_adm'] = isset($xoopsUser) && \is_object($xoopsUser) ? $xoopsUser->isAdmin() : false;

        if (!isset($_SESSION['now_user'])) {
            $_SESSION['now_user'] = ($xoopsUser) ? $xoopsUser->toArray() : [];
        }

        if ($_SESSION['now_user']) {
            if (!isset($_SESSION['SchoolCode'])) {
                if (isset($_REQUEST['SchoolCode']) && $_REQUEST['SchoolCode']) {
                    $_SESSION['SchoolCode'] = Request::getString('SchoolCode');
                } else {
                    $_SESSION['SchoolCode'] = ($xoopsUser) ? $xoopsUser->user_intrest() : false;
                }
            }
        }
    }
}
