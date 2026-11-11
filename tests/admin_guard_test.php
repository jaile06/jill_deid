<?php

declare(strict_types=1);

// spec §9.3 第 5 項：寫入 op 以 GET 呼叫、缺 token、非管理員皆被拒。以 HTTP 對本機站台實測，測試規則必須原封不動；
// 管理員的情況用 XOOPS 自己的 session 處理器開一個 uid 1 的 session（綁定 127.0.0.1，所以連 127.0.0.1），
// 並以「POST＋有效 token 會成功」當對照，證明前面是被檢查擋下，不是 session 無效。
// php tests/admin_guard_test.php     會寫入本機 DB 一筆測試規則與一個 session，結束時刪除。

use XoopsModules\Jill_deid\Rule;
use XoopsModules\Jill_deid\Tools;

$root = dirname(__DIR__, 3);
$ua   = 'jill_deid-admin-guard-test';
$_SERVER = ['HTTP_HOST' => 'localhost', 'SERVER_NAME' => 'localhost', 'SERVER_PORT' => '80', 'REMOTE_ADDR' => '127.0.0.1', 'HTTP_USER_AGENT' => $ua,
    'REQUEST_URI' => '/cli.php', 'SCRIPT_NAME' => '/cli.php', 'PHP_SELF' => '/cli.php', 'REQUEST_METHOD' => 'POST'] + $_SERVER;
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

// 管理員 session：這個行程的 session 由 common.php 以 XOOPS 處理器開啟
$_SESSION['xoopsUserId']     = 1;
$_SESSION['xoopsUserGroups'] = $xoopsUser->getGroups();
$cookie = session_name() . '=' . session_id();
$sid    = session_id();
session_write_close();

$url = 'http://127.0.0.1/modules/jill_deid/admin/main.php'; // 與 session 綁定的 IP 一致

/** One request; returns [status, body]. Redirects are not followed. */
$send = static function (string $method, array $data, ?string $cookie) use ($url, $ua): array {
    $headers = ["Host: localhost", "User-Agent: {$ua}", 'Content-Type: application/x-www-form-urlencoded'];
    if (null !== $cookie) {
        $headers[] = "Cookie: {$cookie}";
    }
    $ctx = stream_context_create(['http' => ['method' => $method, 'ignore_errors' => true, 'follow_location' => 0,
        'header' => implode("\r\n", $headers), 'content' => 'POST' === $method ? http_build_query($data) : '']]);
    $body = @file_get_contents('POST' === $method ? $url : $url . '?' . http_build_query($data), false, $ctx);
    return [false === $body ? 0 : (int) explode(' ', $http_response_header[0] ?? 'HTTP/1.1 0')[1], (string) $body];
};

try {
    foreach (['rule_toggle', 'rule_destroy'] as $op) {
        foreach (['GET', 'POST'] as $method) {
            [$status] = $send($method, ['op' => $op, 'id' => $id], null);
            $check("anonymous {$method} {$op} refused (HTTP {$status}), rule unchanged", $status > 0 && Rule::get($id) === $before);
        }
    }

    [$status, $page] = $send('GET', ['op' => 'rule_index'], $cookie);
    $token           = preg_match('/name="XOOPS_TOKEN_REQUEST"[^>]*value="([^"]+)"/', $page, $m) ? $m[1] : '';
    $check("admin session opens the rule list (HTTP {$status})", 200 === $status && '' !== $token);

    foreach (['rule_toggle', 'rule_destroy'] as $op) {
        $send('GET', ['op' => $op, 'id' => $id], $cookie);
        $check("admin GET {$op} refused, rule unchanged", Rule::get($id) === $before);
        $send('POST', ['op' => $op, 'id' => $id], $cookie);
        $check("admin POST {$op} without token refused, rule unchanged", Rule::get($id) === $before);
    }
    $send('POST', ['op' => 'rule_toggle', 'id' => $id, 'XOOPS_TOKEN_REQUEST' => $token], $cookie);
    $check('control: admin POST rule_toggle with the token works', '0' === (Rule::get($id)['enable'] ?? null));
} finally {
    Rule::destroy($id);
    global $xoopsDB;
    $xoopsDB->exec('DELETE FROM `' . $xoopsDB->prefix('session') . "` WHERE `sess_id` = " . $xoopsDB->quote($sid));
}
echo $fail ? "admin_guard_test: {$fail} failed\n" : "admin_guard_test: all passed\n";
exit($fail ? 1 : 0);
