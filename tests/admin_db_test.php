<?php

declare(strict_types=1);

// spec §9.3 的資料庫與樣板項目：從命令列載入本機 XOOPS，以 uid 1（須為本模組管理員）呼叫類別。
// php tests/admin_db_test.php     會寫入本機 DB，結束時刪除測試資料並還原原本的預設情境。

use XoopsModules\Jill_deid\Config;
use XoopsModules\Jill_deid\Preset;
use XoopsModules\Jill_deid\Rule;

$root = dirname(__DIR__, 3);
$_SERVER += ['HTTP_HOST' => 'localhost', 'SERVER_NAME' => 'localhost', 'SERVER_PORT' => '80', 'REMOTE_ADDR' => '127.0.0.1', 'HTTP_USER_AGENT' => 'cli',
    'REQUEST_URI' => '/cli.php', 'SCRIPT_NAME' => '/cli.php', 'PHP_SELF' => '/cli.php', 'REQUEST_METHOD' => 'POST'];
chdir(sys_get_temp_dir()); // common.php 以工作目錄判斷是否在模組內 // xoops-lint-ignore: test data
require "{$root}/mainfile.php";
// 載入後才設：除錯模式關閉時 common.php 會 error_reporting(0)，並換上 XoopsErrorHandler
$problems = [];
error_reporting(E_ALL);
set_error_handler(static function (int $no, string $msg, string $file, int $line) use (&$problems): bool {
    if ((error_reporting() & $no) && str_contains(str_replace('\\', '/', $file), '/modules/jill_deid/')) { // @ 抑制者不算
        $problems[] = "{$msg} @ {$file}:{$line}";
    }
    return false;
});

$fail  = 0;
$check = static function (string $name, bool $ok) use (&$fail): void {
    echo ($ok ? 'ok   ' : 'FAIL ') . $name . "\n";
    $fail += $ok ? 0 : 1;
};
$xoopsModule = xoops_getHandler('module')->getByDirname('jill_deid');
$xoopsUser   = xoops_getHandler('member')->getUser(1);
if (!$xoopsModule || !$xoopsUser || !$xoopsUser->isAdmin($xoopsModule->mid())) {
    exit("admin_db_test: skipped (jill_deid not installed or uid 1 is not its admin)\n");
}
xoops_loadLanguage('admin', 'jill_deid');
xoops_loadLanguage('modinfo', 'jill_deid');
require_once XOOPS_ROOT_PATH . '/class/template.php';
$xoopsTpl = new XoopsTpl();
$xoTheme  = new class () {
    public function addStylesheet(...$a): void {}
    public function addScript(...$a): void {}
};

$maxId   = static fn (string $table): int => (int) (array_column(XoopsModules\Jill_deid\Tools::rows($table), 'id') ? max(array_column(XoopsModules\Jill_deid\Tools::rows($table), 'id')) : 0);
$ruleId0 = $maxId(Rule::TABLE);
$preId0  = $maxId(Preset::TABLE);
$defaults = array_column(array_filter(XoopsModules\Jill_deid\Tools::rows(Preset::TABLE), static fn ($p) => '1' === $p['is_default']), 'id');
$post    = static function (array $data): void {
    $_POST = $data;
};

try {
    // §9.3：表單儲存後 DB 內字串與輸入完全相同（getText，不是 getString）
    foreach (['(?<!\d)1\d{5}' => 'x 123456', '(?<y>\d{4})' => 'year 2026', 'a<b>c\d' => 'a<b>c1'] as $pattern => $sample) {
        $post(['title' => "CLI {$pattern}", 'category' => 'CLI測試', 'pattern' => $pattern, 'retention' => '{"mode":"none"}', // xoops-lint-ignore: test data
            'sample_text' => $sample, 'apply_to_url' => '1', 'enable' => '1', 'sort' => '9']);
        $errors = Rule::store();
        $row    = Rule::get($maxId(Rule::TABLE));
        $check("stored pattern {$pattern} unchanged", [] === $errors && $row['pattern'] === $pattern && $row['sample_text'] === $sample);
    }
    $post(['title' => 'CLI bad', 'category' => 'CLI測試', 'pattern' => '(a+)+', 'retention' => '{"mode":"none"}', 'enable' => '1']); // xoops-lint-ignore: test data
    $before = $maxId(Rule::TABLE);
    $check('nested quantifier refused, nothing stored', in_array('PATTERN_NESTED', Rule::store(), true) && $maxId(Rule::TABLE) === $before);

    $id = $maxId(Rule::TABLE);
    Rule::toggle($id);
    $check('toggle disables', '0' === Rule::get($id)['enable']);
    $regexes = array_column(Config::build()['orgRules'], 'regex');
    $check('config: enabled rules only, regex unchanged', in_array('(?<!\d)1\d{5}', $regexes, true) && !in_array('a<b>c\d', $regexes, true));
    Rule::destroy($id);
    $check('destroy', null === Rule::get($id));

    // 規則包：第一次匯入 5 條（若尚未匯入），第二次全部略過
    $titles = array_column(json_decode((string) file_get_contents(dirname(__DIR__) . '/include/rule_pack.json'), true), 'title');
    $had    = array_intersect($titles, array_column(XoopsModules\Jill_deid\Tools::rows(Rule::TABLE), 'title'));
    [$imported] = Rule::import_pack();
    $check('rule pack imports the missing rules', count($titles) - count($had) === $imported);
    $check('rule pack import again skips all', [0, count($titles)] === Rule::import_pack());

    // 情境：is_default 全站只有一筆；custom_config 驗證
    foreach (['A', 'B'] as $t) {
        $post(['title' => "CLI preset {$t}", 'keep_strategy' => 'custom', 'marker_style' => 'code', 'hyperlink_mode' => 'mask_pii_in_url',
            'custom_config' => '{"學號":{"mode":"ends","head":3,"tail":0}}', 'is_default' => '1', 'enable' => '1']); // xoops-lint-ignore: test data
        $check("preset {$t} stored", [] === Preset::store());
    }
    $check('only one default preset', 1 === count(array_filter(XoopsModules\Jill_deid\Tools::rows(Preset::TABLE), static fn ($p) => '1' === $p['is_default'])));
    $check('config: exactly one isDefault', 1 === count(array_filter(Config::build()['presets'], static fn ($p) => $p['isDefault'])));
    $post(['title' => 'CLI bad preset', 'keep_strategy' => 'custom', 'marker_style' => 'code', 'hyperlink_mode' => 'mask_pii_in_url',
        'custom_config' => '{"學號":{"mode":"x"}}', 'enable' => '1']); // xoops-lint-ignore: test data
    $check('bad custom_config refused', in_array('CUSTOM_CONFIG', Preset::store(), true));
    $json = Config::toJson();
    $check('config JSON escapes </script>', !str_contains($json, '</') && is_array(json_decode($json, true)));

    // 樣板以真的 Smarty 渲染，不得有錯誤
    $render = static function (string $op) use ($xoopsTpl, $root): string {
        $xoopsTpl->assign('now_op', $op);
        return $xoopsTpl->fetch("{$root}/modules/jill_deid/templates/jill_deid_admin.tpl");
    };
    Rule::index();
    $html = $render('rule_index');
    $check('rule list renders with token and import button', str_contains($html, 'XOOPS_TOKEN_REQUEST') && str_contains($html, 'rule_import_pack'));
    Rule::create($maxId(Rule::TABLE));
    $html = $render('rule_form');
    $check('rule form renders the stored pattern escaped', str_contains($html, 'name="pattern"') && str_contains($html, 'value="rule_update"'));
    Rule::create(0, Rule::FIELDS, ['PATTERN_NESTED']);
    $check('rule form shows errors', str_contains($render('rule_form'), _AM_JILLDEID_ERR_PATTERN_NESTED));
    Preset::index();
    $check('preset list renders', str_contains($render('preset_index'), 'preset_toggle'));
    Preset::create($maxId(Preset::TABLE));
    $check('preset form renders choices', str_contains($render('preset_form'), _AM_JILLDEID_KEEP_STRATEGY_CUSTOM));
} finally {
    global $xoopsDB;
    foreach ([Rule::TABLE => $ruleId0, Preset::TABLE => $preId0] as $table => $id0) {
        $xoopsDB->exec('DELETE FROM `' . $xoopsDB->prefix($table) . "` WHERE `id` > {$id0}");
    }
    foreach ($defaults as $id) {
        $xoopsDB->exec('UPDATE `' . $xoopsDB->prefix(Preset::TABLE) . "` SET `is_default` = '1' WHERE `id` = " . (int) $id);
    }
}
$check('no PHP warnings from this module', [] === $problems);
foreach ($problems as $p) {
    echo "  {$p}\n";
}
echo $fail ? "admin_db_test: {$fail} failed\n" : "admin_db_test: all passed\n";
exit($fail ? 1 : 0);
