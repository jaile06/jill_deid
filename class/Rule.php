<?php

declare(strict_types=1);

namespace XoopsModules\Jill_deid;

use Xmf\Request;

/**
 * 機構規則（spec §3.1、§3.3、§6.4）。validate()、riskyPattern()、validateRetention() 是純函式，
 * 不碰 XOOPS，由 tests/rule_validate_test.php 直接呼叫；錯誤以代碼回傳，對應語言常數 _AM_JILLDEID_ERR_<代碼>。
 */
class Rule
{
    public const TABLE = 'jill_deid_rule';

    /** 表單欄位與預設值；存檔、匯入、驗證共用（uid 另由登入者取得） */
    public const FIELDS = [
        'title'        => '',
        'category'     => '',
        'pattern'      => '',
        'apply_to_url' => '1',
        'retention'    => '{"mode":"none"}',
        'sample_text'  => '',
        'description'  => '',
        'locked'       => '0',
        'enable'       => '1',
        'sort'         => 0,
    ];

    // spec §3.3：pattern 只跳脫不改寫；retention 為 JSON 字串
    public static array $filter_arr = [
        'pass' => ['pattern'],
        'json' => ['retention'],
        'int'  => ['sort', 'uid'],
        'text' => ['title', 'category', 'sample_text', 'description'],
    ];

    /** include/categories.json：上游內建類別與保留字「網址」，以及 surname、address 對應的類別 */
    public static function categories(): array
    {
        static $categories = null;
        return $categories ??= json_decode((string) file_get_contents(dirname(__DIR__) . '/include/categories.json'), true, 8, JSON_THROW_ON_ERROR);
    }

    /** spec §3.3：回傳錯誤代碼，空陣列表示通過 */
    public static function validate(array $data): array
    {
        $errors = [];
        $title  = (string) ($data['title'] ?? '');
        if ('' === trim($title) || mb_strlen($title) > 100) {
            $errors[] = 'TITLE';
        }

        $pattern = (string) ($data['pattern'] ?? '');
        if (mb_strlen($pattern) < 1 || mb_strlen($pattern) > 500 || preg_match('/[\r\n\0]/', $pattern)) {
            $errors[] = 'PATTERN_LENGTH';
        } elseif (null !== ($risk = self::riskyPattern($pattern))) {
            $errors[] = $risk;
        } elseif (1 === @preg_match("\x01(?:{$pattern})\x01u", '')) {
            // false 表示 PCRE 不支援該語法（例如不定長 lookbehind），交給表單的 JS 檢查
            $errors[] = 'PATTERN_EMPTY';
        }

        $category = (string) ($data['category'] ?? '');
        if (!preg_match('/^[^\[\]:\s]{1,10}$/u', $category)) {
            $errors[] = 'CATEGORY_FORMAT';
        } elseif (in_array($category, self::categories()['reserved'], true)) {
            $errors[] = 'CATEGORY_RESERVED';
        }

        array_push($errors, ...self::validateRetention((string) ($data['retention'] ?? ''), $category));

        if (mb_strlen((string) ($data['sample_text'] ?? '')) > 255 || mb_strlen((string) ($data['description'] ?? '')) > 255) {
            $errors[] = 'TEXT_LENGTH';
        }
        foreach (['apply_to_url', 'locked', 'enable'] as $flag) {
            if (!in_array((string) ($data[$flag] ?? ''), ['0', '1'], true)) {
                $errors[] = 'FLAG';
            }
        }
        return array_values(array_unique($errors));
    }

    /**
     * 災難性回溯的常見結構（spec §3.3-2）：反向引用、群組內有重複量詞且群組本身又被重複、含交替的群組被重複。
     * ponytail: 黑名單只擋常見寫法，不求完備；真正的保護是前台 Worker 逾時（spec §3.3、INV-3）。
     */
    public static function riskyPattern(string $p): ?string
    {
        // 每個未關閉的群組：內部是否有可變長度的量詞（repeat）、是否有頂層交替（alt）。
        // 群組內可變長度、外面又重複（含 {5} 這種固定次數）才會回溯失控；(\d{3}-){2} 內層固定寬度，放行。
        $stack = [];
        $len   = strlen($p); // 語法字元都是 ASCII，逐位元組掃描即可
        for ($i = 0; $i < $len; $i++) {
            $c = $p[$i];
            if ('\\' === $c) {
                $next = $p[$i + 1] ?? '';
                if ('k' === $next || (ctype_digit($next) && '0' !== $next)) {
                    return 'PATTERN_BACKREF';
                }
                $i++;
                continue;
            }
            if ('[' === $c) { // 字元類別內的符號都是字面值
                for ($i++; $i < $len && ']' !== $p[$i]; $i++) {
                    if ('\\' === $p[$i]) {
                        $i++;
                    }
                }
                continue;
            }
            $top = array_key_last($stack);
            if ('(' === $c) {
                $stack[] = ['repeat' => false, 'alt' => false];
            } elseif ('|' === $c && null !== $top) {
                $stack[$top]['alt'] = true;
            } elseif (')' === $c) {
                $group          = array_pop($stack) ?? ['repeat' => false, 'alt' => false];
                [$var, $times]  = self::quantifierAt($p, $i + 1);
                if ($times && $group['repeat']) {
                    return 'PATTERN_NESTED';
                }
                if ($var && $group['alt']) {
                    return 'PATTERN_ALT';
                }
                $parent = array_key_last($stack);
                if (null !== $parent && ($group['repeat'] || $var)) {
                    $stack[$parent]['repeat'] = true;
                }
            } elseif (null !== $top && self::quantifierAt($p, $i)[0]) {
                $stack[$top]['repeat'] = true;
            }
        }
        return null;
    }

    /**
     * $p[$i] 起的量詞：[長度可變（+、*、{n,}、{n,m} 且 m > n）, 可重複超過一次（含 {n} 且 n > 1）]
     */
    private static function quantifierAt(string $p, int $i): array
    {
        $c = $p[$i] ?? '';
        if ('+' === $c || '*' === $c) {
            return [true, true];
        }
        if ('{' !== $c || !preg_match('/\G\{(\d+)(,(\d*))?\}/', $p, $m, 0, $i)) {
            return [false, false];
        }
        $min = (int) $m[1];
        $max = !isset($m[2]) ? $min : ('' === $m[3] ? PHP_INT_MAX : (int) $m[3]);
        return [$max > $min, $max > 1];
    }

    /** spec §3.4 白名單；$category 決定 surname、city、district 是否可用 */
    public static function validateRetention(string $json, string $category): array
    {
        $r = json_decode($json, true);
        if (!is_array($r) || !is_string($r['mode'] ?? null)) {
            return ['RETENTION'];
        }
        $keys = array_keys($r);
        sort($keys);
        $int  = static fn ($v): bool => is_int($v) && $v >= 0 && $v <= 20;
        $ok   = match ($r['mode']) {
            'none', 'preview'  => ['mode'] === $keys,
            'ends'             => ['head', 'mode', 'tail'] === $keys && $int($r['head']) && $int($r['tail']),
            'delim'            => ['delimiter', 'mode', 'side'] === $keys && is_string($r['delimiter'])
                && mb_strlen($r['delimiter']) >= 1 && mb_strlen($r['delimiter']) <= 3 && in_array($r['side'], ['before', 'after'], true),
            'surname'          => ['mode'] === $keys && self::categories()['surname'] === $category,
            'city', 'district' => ['mode'] === $keys && self::categories()['address'] === $category,
            default            => false,
        };
        return $ok ? [] : ['RETENTION'];
    }

    /** 表單送來的欄位；pattern、retention、自由文字一律 getText（getString 會破壞 regex，spec §B） */
    public static function posted(): array
    {
        return [
            'title'        => Request::getString('title', '', 'POST'),
            'category'     => Request::getString('category', '', 'POST'),
            'pattern'      => Request::getText('pattern', '', 'POST'),
            'apply_to_url' => Request::getInt('apply_to_url', 0, 'POST') ? '1' : '0',
            'retention'    => Request::getText('retention', '', 'POST'),
            'sample_text'  => Request::getText('sample_text', '', 'POST'),
            'description'  => Request::getText('description', '', 'POST'),
            'locked'       => Request::getInt('locked', 0, 'POST') ? '1' : '0',
            'enable'       => Request::getInt('enable', 0, 'POST') ? '1' : '0',
            'sort'         => Request::getInt('sort', 0, 'POST'),
        ];
    }

    public static function index(): void
    {
        global $xoopsTpl, $xoTheme;
        $xoopsTpl->assign('rules', Tools::rows(self::TABLE));
        $xoTheme->addStylesheet('modules/tadtools/sweet-alert/sweet-alert.css');
        $xoTheme->addScript('modules/tadtools/sweet-alert/sweet-alert.js');
        \XoopsModules\Tadtools\Utility::token_form();
    }

    public static function get(int $id): ?array
    {
        return Tools::rows(self::TABLE, "WHERE `id` = {$id}")[0] ?? null;
    }

    /** 新增／編輯表單；$data、$errors 用於驗證失敗後回填 */
    public static function create(int $id = 0, ?array $data = null, array $errors = []): void
    {
        global $xoopsTpl, $xoTheme;
        $data ??= ($id ? self::get($id) : null) ?? self::FIELDS;
        $xoopsTpl->assign('rule', $data);
        $xoopsTpl->assign('rule_id', $id);
        $xoopsTpl->assign('errors', array_map(static fn (string $c): string => constant('_AM_JILLDEID_ERR_' . $c), $errors));
        $xoopsTpl->assign('next_op', $id ? 'rule_update' : 'rule_store');
        $xoTheme->addScript('modules/jill_deid/assets/js/jill/admin-rule.js', ['type' => 'module']);
        \XoopsModules\Tadtools\Utility::token_form();
    }

    /** 回傳錯誤代碼；空陣列表示已存檔 */
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
        global $xoopsUser;
        $data   = self::posted();
        $errors = self::validate($data);
        if (!$errors) {
            Tools::save(self::TABLE, $data + ['uid' => (int) $xoopsUser->uid()], self::$filter_arr, $id);
        }
        return $errors;
    }

    public static function destroy(int $id): void
    {
        Tools::delete(self::TABLE, $id);
    }

    public static function toggle(int $id): void
    {
        Tools::toggle(self::TABLE, $id);
    }

    /** 匯入 include/rule_pack.json（spec §6.4），同 title 略過。回傳 [匯入數, 略過數] */
    public static function import_pack(): array
    {
        global $xoopsUser;
        $pack     = json_decode((string) file_get_contents(dirname(__DIR__) . '/include/rule_pack.json'), true, 8, JSON_THROW_ON_ERROR);
        $existing = array_column(Tools::rows(self::TABLE), 'title');
        $sort     = count($existing);
        $imported = 0;
        foreach ($pack as $rule) {
            if (in_array($rule['title'], $existing, true)) {
                continue;
            }
            $data = array_merge(self::FIELDS, $rule, [
                'retention' => json_encode($rule['retention'], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
                'sort'      => ++$sort,
            ]);
            if (!self::validate($data)) {
                Tools::save(self::TABLE, $data + ['uid' => (int) $xoopsUser->uid()], self::$filter_arr);
                $imported++;
            }
        }
        return [$imported, count($pack) - $imported];
    }
}
