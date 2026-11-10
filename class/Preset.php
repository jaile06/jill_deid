<?php

declare(strict_types=1);

namespace XoopsModules\Jill_deid;

use Xmf\Request;
use XoopsModules\Tadtools\Utility;

/** 處理情境（spec §3.2、§3.4）。validate() 是純函式，錯誤代碼對應 _AM_JILLDEID_ERR_<代碼> */
class Preset
{
    public const TABLE = 'jill_deid_preset';

    public const FIELDS = [
        'title'          => '',
        'description'    => '',
        'keep_strategy'  => 'partial',
        'marker_style'   => 'code',
        'hyperlink_mode' => 'mask_pii_in_url',
        'custom_config'  => '{}',
        'is_default'     => '0',
        'enable'         => '1',
        'sort'           => 0,
    ];

    public const CHOICES = [
        'keep_strategy'  => ['partial', 'hide_all', 'custom'],
        'marker_style'   => ['code', 'label', 'blank'],
        'hyperlink_mode' => ['mask_pii_in_url', 'strip_link'],
    ];

    public static array $filter_arr = [
        'json' => ['custom_config'],
        'int'  => ['sort'],
        'text' => ['title', 'description'],
    ];

    public static function validate(array $data): array
    {
        $errors = [];
        $title  = (string) ($data['title'] ?? '');
        if ('' === trim($title) || mb_strlen($title) > 100) {
            $errors[] = 'TITLE';
        }
        if (mb_strlen((string) ($data['description'] ?? '')) > 255) {
            $errors[] = 'TEXT_LENGTH';
        }
        foreach (self::CHOICES as $key => $allowed) {
            if (!in_array((string) ($data[$key] ?? ''), $allowed, true)) {
                $errors[] = 'FLAG';
            }
        }
        foreach (['is_default', 'enable'] as $flag) {
            if (!in_array((string) ($data[$flag] ?? ''), ['0', '1'], true)) {
                $errors[] = 'FLAG';
            }
        }
        // custom_config：{ "<類別>": <Retention> }（spec §3.4）
        $custom = json_decode((string) ($data['custom_config'] ?? ''));
        if (!$custom instanceof \stdClass) {
            $errors[] = 'CUSTOM_CONFIG';
        } else {
            foreach ((array) $custom as $category => $retention) {
                if (!preg_match('/^[^\[\]:\s]{1,10}$/u', (string) $category)
                    || Rule::validateRetention(json_encode($retention, JSON_UNESCAPED_UNICODE), (string) $category)) {
                    $errors[] = 'CUSTOM_CONFIG';
                    break;
                }
            }
        }
        return array_values(array_unique($errors));
    }

    public static function posted(): array
    {
        $custom = trim(Request::getText('custom_config', '', 'POST'));
        return [
            'title'          => Request::getString('title', '', 'POST'),
            'description'    => Request::getText('description', '', 'POST'),
            'keep_strategy'  => Request::getString('keep_strategy', '', 'POST'),
            'marker_style'   => Request::getString('marker_style', '', 'POST'),
            'hyperlink_mode' => Request::getString('hyperlink_mode', '', 'POST'),
            'custom_config'  => '' === $custom ? '{}' : $custom,
            'is_default'     => Request::getInt('is_default', 0, 'POST') ? '1' : '0',
            'enable'         => Request::getInt('enable', 0, 'POST') ? '1' : '0',
            'sort'           => Request::getInt('sort', 0, 'POST'),
        ];
    }

    public static function index(): void
    {
        global $xoopsTpl, $xoTheme;
        $xoopsTpl->assign('presets', Tools::rows(self::TABLE));
        $xoTheme->addStylesheet('modules/tadtools/sweet-alert/sweet-alert.css');
        $xoTheme->addScript('modules/tadtools/sweet-alert/sweet-alert.js');
        Utility::token_form();
    }

    public static function get(int $id): ?array
    {
        return Tools::rows(self::TABLE, "WHERE `id` = {$id}")[0] ?? null;
    }

    public static function create(int $id = 0, ?array $data = null, array $errors = []): void
    {
        global $xoopsTpl;
        $data ??= ($id ? self::get($id) : null) ?? self::FIELDS;
        $xoopsTpl->assign('preset', $data);
        $xoopsTpl->assign('preset_id', $id);
        // 選項文字：_AM_JILLDEID_<欄位>_<值>，例如 _AM_JILLDEID_KEEP_STRATEGY_PARTIAL
        $choices = [];
        foreach (self::CHOICES as $key => $values) {
            foreach ($values as $v) {
                $choices[$key][$v] = constant('_AM_JILLDEID_' . strtoupper("{$key}_{$v}"));
            }
        }
        $xoopsTpl->assign('choices', $choices);
        $xoopsTpl->assign('errors', array_map(static fn (string $c): string => constant('_AM_JILLDEID_ERR_' . $c), $errors));
        $xoopsTpl->assign('next_op', $id ? 'preset_update' : 'preset_store');
        Utility::token_form();
    }

    public static function store(): array
    {
        return self::save(0);
    }

    public static function update(int $id): array
    {
        return self::save($id);
    }

    private static function save(int $id): array
    {
        global $xoopsDB;
        $data   = self::posted();
        $errors = self::validate($data);
        if ($errors) {
            return $errors;
        }
        $id = Tools::save(self::TABLE, $data, self::$filter_arr, $id);
        if ('1' === $data['is_default']) { // 全站只有一筆預設（spec §3.2）
            $sql = 'UPDATE `' . $xoopsDB->prefix(self::TABLE) . "` SET `is_default` = '0' WHERE `id` != {$id}";
            $xoopsDB->exec($sql) or Utility::web_error($sql, __FILE__, __LINE__);
        }
        return [];
    }

    public static function destroy(int $id): void
    {
        Tools::delete(self::TABLE, $id);
    }

    public static function toggle(int $id): void
    {
        Tools::toggle(self::TABLE, $id);
    }
}
