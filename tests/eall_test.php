<?php

declare(strict_types=1);

// spec §9.1 第 1 項：前台（各允許佈景）與後台每個畫面在 E_ALL 下，本模組檔案 0 個 Error／Warning／Deprecated。
// 除錯模式關閉時 common.php 會 error_reporting(0) 並換上 XoopsErrorHandler，網頁上看不到任何訊息；
// 這裡先載入 XOOPS，再設回 E_ALL 與自己的處理器，才 include 頁面。每頁一個子行程（頁面會 exit）。
// php tests/eall_test.php      只讀，不寫 DB（後台只跑顯示畫面，不跑寫入 op）

$php  = PHP_BINARY;
$root = dirname(__DIR__, 3);

if ('--page' === ($argv[1] ?? '')) {
    [, , $page, $query, $theme] = $argv + [2 => '', 3 => '', 4 => ''];
    $self = "/modules/jill_deid/{$page}";
    parse_str($query, $_GET);
    $_REQUEST = $_GET;
    $_SERVER  = ['HTTP_HOST' => 'localhost', 'SERVER_NAME' => 'localhost', 'SERVER_PORT' => '80', 'SERVER_ADDR' => '127.0.0.1',
        'SERVER_SOFTWARE' => 'cli', 'REMOTE_ADDR' => '127.0.0.1', 'HTTP_USER_AGENT' => 'cli', 'QUERY_STRING' => $query,
        'REQUEST_URI' => $self . ('' === $query ? '' : "?{$query}"), 'SCRIPT_NAME' => $self, 'PHP_SELF' => $self,
        'REQUEST_METHOD' => '' === $theme ? 'GET' : 'POST', 'SCRIPT_FILENAME' => $root . $self] + $_SERVER;
    if ('' !== $theme) {
        $_POST['xoops_theme_select'] = $theme; // xoops-lint-ignore: test data
    }
    chdir(dirname($root . $self)); // xoops-lint-ignore: test data
    require_once "{$root}/mainfile.php";
    if (str_starts_with($page, 'admin/')) {
        $GLOBALS['xoopsUser']        = xoops_getHandler('member')->getUser(1);
        $GLOBALS['xoopsUserIsAdmin'] = true;
    }
    $mine = [];
    error_reporting(E_ALL);
    set_error_handler(static function (int $no, string $msg, string $file, int $line) use (&$mine): bool {
        if ((error_reporting() & $no) && str_contains(str_replace('\\', '/', $file), '/modules/jill_deid/')) { // @ 抑制者不算
            $mine[] = "{$msg} @ {$file}:{$line}";
        }
        return true;
    });
    register_shutdown_function(static function () use (&$mine): void {
        $e = error_get_last();
        if ($e && in_array($e['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
            $mine[] = "fatal {$e['message']} @ {$e['file']}:{$e['line']}";
        }
        $html = ob_get_level() ? (string) ob_get_contents() : '';
        while (ob_get_level()) {
            ob_end_clean();
        }
        // 頁面須真的渲染出本模組內容（不是「模組不存在」之類的錯誤頁）
        if (!str_contains($html, 'jill_deid') && !str_contains($html, 'jill-deid')) {
            $mine[] = 'page did not render the module (' . strlen($html) . ' bytes)';
        }
        echo json_encode($mine, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), "\n";
    });
    ob_start();
    require $root . $self;
    exit;
}

// 父行程：列出要跑的頁面，允許的佈景由 DB 讀
$_SERVER += ['HTTP_HOST' => 'localhost', 'REQUEST_URI' => '/cli.php', 'SCRIPT_NAME' => '/cli.php', 'PHP_SELF' => '/cli.php', 'REQUEST_METHOD' => 'GET', 'REMOTE_ADDR' => '127.0.0.1'];
chdir(sys_get_temp_dir()); // xoops-lint-ignore: test data
require "{$root}/mainfile.php";
$module = xoops_getHandler('module')->getByDirname('jill_deid');
$admin  = xoops_getHandler('member')->getUser(1);
if (!$module || !$admin || !$admin->isAdmin($module->mid())) {
    exit("eall_test: skipped (jill_deid not installed or uid 1 is not its admin)\n");
}
global $xoopsDB, $xoopsConfig;
$first = static function (string $table) use ($xoopsDB): int {
    $result = $xoopsDB->query('SELECT MIN(`id`) AS m FROM `' . $xoopsDB->prefix($table) . '`');
    if (!$xoopsDB->isResultSet($result)) {
        return 0;
    }
    return (int) ($xoopsDB->fetchArray($result)['m'] ?? 0);
};
$pages = [];
foreach ($xoopsConfig['theme_set_allowed'] as $theme) {
    $pages[] = ['index.php', '', $theme];
}
foreach (['op=rule_index', 'op=rule_create', 'op=rule_edit&id=' . $first('jill_deid_rule'), 'op=preset_index', 'op=preset_create',
    'op=preset_edit&id=' . $first('jill_deid_preset')] as $q) {
    $pages[] = ['admin/main.php', $q, ''];
}
$pages[] = ['admin/index.php', '', ''];
$pages[] = ['admin/about.php', '', ''];

$fail = 0;
foreach ($pages as [$page, $query, $theme]) {
    $out  = (string) shell_exec(escapeshellarg($php) . ' ' . escapeshellarg(__FILE__) . ' --page ' . escapeshellarg($page) . ' '
        . escapeshellarg($query) . ' ' . escapeshellarg($theme) . ' 2>&1');
    $last = json_decode(trim((string) strrchr("\n" . trim($out), "\n")), true);
    $ok   = [] === $last;
    $fail += $ok ? 0 : 1;
    echo ($ok ? 'ok   ' : 'FAIL ') . trim("{$page}?{$query} {$theme}") . "\n";
    foreach (is_array($last) ? $last : [substr(trim($out), -300)] as $p) {
        if (!$ok) {
            echo "  {$p}\n";
        }
    }
}
echo $fail ? "eall_test: {$fail} failed\n" : "eall_test: all passed\n";
exit($fail ? 1 : 0);
