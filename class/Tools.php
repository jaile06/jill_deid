<?php

declare(strict_types=1);

namespace XoopsModules\Jill_deid;

/**
 * 由 dinfo Tools 精簡：只留欄位過濾與 SQL 組裝。
 * 權限一律在入口檔以 $xoopsUser->isAdmin($xoopsModule->mid()) 判斷，不經 $_SESSION（規格 §6.3）。
 */
class Tools
{
    /**
     * 依 $filter_arr 過濾欄位值
     *
     * @param string $mode read＝顯示、write＝寫入 DB（escape）、edit＝回填表單
     */
    public static function filter(string $key, mixed $value, string $mode = 'read', array $filter_arr = []): mixed
    {
        global $xoopsDB;
        $myts = \MyTextSanitizer::getInstance();
        $in   = static fn (string $type): bool => in_array($key, $filter_arr[$type] ?? [], true);

        // pass：讀取原樣（如 regex），寫入仍須 escape
        if ($in('pass')) {
            return 'write' === $mode ? $xoopsDB->escape((string) ($value ?? '')) : $value;
        }

        if ($in('json')) {
            if ('write' === $mode) {
                $json = is_string($value) ? $value : json_encode($value, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
                return $xoopsDB->escape(trim($json));
            }
            $decoded = is_string($value) && '' !== $value ? json_decode($value, true) : $value;
            return is_array($decoded) ? $decoded : [];
        }

        if (is_array($value)) {
            foreach ($value as $k => $v) {
                $value[$k] = self::filter($key, $v, $mode, $filter_arr);
            }
            return $value;
        }

        if ($in('int')) {
            return (int) $value;
        }

        $value = (string) ($value ?? '');
        if ('write' === $mode) {
            return $xoopsDB->escape(trim($value));
        }
        if ('edit' === $mode || !$in('text')) {
            return $myts->htmlSpecialChars($value);
        }
        return $myts->displayTarea($value, 0, 0, 0, 1, 1);
    }

    // 過濾整筆資料
    public static function filter_all_data(string $mode, array $data, array $filter_arr): array
    {
        foreach ($data as $key => $value) {
            $data[$key] = self::filter((string) $key, $value, $mode, $filter_arr);
        }
        return $data;
    }

    // 組 AND 條件；只接受字串欄位名，值一律 escape
    public static function get_and_where(array $where_arr = [], string $prefix = ''): string
    {
        global $xoopsDB;
        $sql = '';
        foreach ($where_arr as $col => $value) {
            if (is_string($col)) {
                $sql .= " AND {$prefix}`{$col}` = '" . $xoopsDB->escape((string) $value) . "'";
            }
        }
        return $sql;
    }

    // 組欄位清單
    public static function get_view_col(array $view_cols = [], string $prefix = ''): string
    {
        return empty($view_cols) ? $prefix . '*' : $prefix . '`' . implode("`, {$prefix}`", $view_cols) . '`';
    }

    // 組 ORDER BY；方向只允許 ASC／DESC
    public static function get_order(array $order_arr = [], string $prefix = ''): string
    {
        $items = [];
        foreach ($order_arr as $col => $dir) {
            $items[] = "{$prefix}`{$col}` " . ('DESC' === strtoupper((string) $dir) ? 'DESC' : 'ASC');
        }
        return $items ? 'ORDER BY ' . implode(', ', $items) : '';
    }
}
