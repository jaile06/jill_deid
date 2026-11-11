<?php

declare(strict_types=1);

// spec §9.3 第 6 項的未登入部分：以 HTTP 對本機站台送寫入 op（GET 與 POST、無 token、未登入），測試規則必須原封不動。
// 管理員以 GET 呼叫、管理員缺 token 兩種要登入的情況由人工確認（spec §9.3）。
// php tests/admin_guard_test.php     會寫入本機 DB 一筆測試規則，結束時刪除。

use XoopsModules\Jill_deid\Rule;
use XoopsModules\Jill_deid\Tools;

$root = dirname(__DIR__, 3);
$_SERVER += ['HTTP_HOST' => 'localhost', 'SERVER_NAME' => 'localhost', 'SERVER_PORT' => '80', 'REMOTE_ADDR' => '127.0.0.1', 'HTTP_USER_AGENT' => 'cli',
    'REQUEST_URI' => '/cli.php', 'SCRIPT_NAME' => '/cli.php', 'PHP_SELF' => '/cli.php', 'REQUEST_METHOD' => 'POST'];
chdir(sys_get_temp_dir()); // common.php 以工作目錄判斷是否在模組內 // xoops-lint-ignore: test data
require "{$root}/mainfile.php";

$fail  = 0;
$check = static function (string $name, bool $ok) use (&$fail): void {
    echo ($ok ? 'ok   ' : 'FAIL ') . $name . "\n";
    $fail += $ok ? 0 : 1;
};
$xoopsModule = xoops_getHandler('module')->getByDirname('jill_deid');
$xoopsUser   = xoops_getHandler('member')->getUser(1);
if (!$xoopsModule || !$xoopsUser || !$xoopsUser->isAdmin($xoopsModule->mid())) {
    exit("admin_guard_test: skipped (jill_deid not installed or uid 1 is not its admin)\n");
}
xoops_loadLanguage('admin', 'jill_deid');

$_POST = ['title' => 'CLI guard', 'category' => 'CLI測試', 'pattern' => 'guard\d{3}', 'retention' => '{"mode":"none"}', // xoops-lint-ignore: test data
    'sample_text' => 'guard123', 'apply_to_url' => '1', 'enable' => '1', 'sort' => '9'];
Rule::store();
$id     = (int) max(array_column(Tools::rows(Rule::TABLE), 'id'));
$before = Rule::get($id);
$url    = XOOPS_URL . '/modules/jill_deid/admin/main.php';

/** One anonymous request; returns the HTTP status (redirects are not followed). */
$send = static function (string $method, string $op) use ($url, $id): int {
    $ctx = stream_context_create(['http' => ['method' => $method, 'ignore_errors' => true, 'follow_location' => 0,
        'header' => 'Content-Type: application/x-www-form-urlencoded', 'content' => 'POST' === $method ? http_build_query(['op' => $op, 'id' => $id]) : '']]);
    $res = @file_get_contents('POST' === $method ? $url : "{$url}?op={$op}&id={$id}", false, $ctx);
    return false === $res ? 0 : (int) explode(' ', $http_response_header[0] ?? 'HTTP/1.1 0')[1];
};

try {
    foreach (['rule_toggle', 'rule_destroy'] as $op) {
        foreach (['GET', 'POST'] as $method) {
            $status = $send($method, $op);
            $check("anonymous {$method} {$op} refused (HTTP {$status}), rule unchanged", $status > 0 && Rule::get($id) === $before);
        }
    }
} finally {
    Rule::destroy($id);
}
echo $fail ? "admin_guard_test: {$fail} failed\n" : "admin_guard_test: all passed\n";
exit($fail ? 1 : 0);
