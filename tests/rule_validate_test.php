<?php

declare(strict_types=1);

// spec §9.3：Rule::validate() 純函式測試，免 XOOPS、免 PHPUnit。php tests/rule_validate_test.php
require dirname(__DIR__) . '/class/Rule.php';

use XoopsModules\Jill_deid\Rule;

$fail = 0;
$check = static function (string $name, bool $ok) use (&$fail): void {
    echo ($ok ? 'ok   ' : 'FAIL ') . $name . "\n";
    $fail += $ok ? 0 : 1;
};
$rule = static fn (array $over): array => array_merge(Rule::FIELDS, ['title' => 'T', 'category' => '學號', 'pattern' => '\d{6}'], $over); // xoops-lint-ignore: test data
$codes = static fn (array $over): array => Rule::validate($rule($over));

// 拒絕
foreach ([
    '(a+)+$'  => 'PATTERN_NESTED',
    '(\w*)*x' => 'PATTERN_NESTED',
    '(.*){2,}' => 'PATTERN_NESTED',
    '(a+){5}b' => 'PATTERN_NESTED',
    '(a|a)+'  => 'PATTERN_ALT',
    '(a)\1'   => 'PATTERN_BACKREF',
    '(?<x>a)\k<x>' => 'PATTERN_BACKREF',
    'a*'      => 'PATTERN_EMPTY',
    ''        => 'PATTERN_LENGTH',
    "a\nb"    => 'PATTERN_LENGTH',
] as $pattern => $code) {
    $check("pattern {$pattern} rejected as {$code}", in_array($code, $codes(['pattern' => $pattern]), true));
}
$check('category with : rejected', in_array('CATEGORY_FORMAT', $codes(['category' => 'a:b']), true));
$check('11-char category rejected', in_array('CATEGORY_FORMAT', $codes(['category' => str_repeat('類', 11)]), true)); // xoops-lint-ignore: test data
$check('built-in category 姓名 rejected', in_array('CATEGORY_RESERVED', $codes(['category' => '姓名']), true)); // xoops-lint-ignore: test data
$check('reserved 網址 rejected', in_array('CATEGORY_RESERVED', $codes(['category' => '網址']), true)); // xoops-lint-ignore: test data
foreach (['{"mode":"ends","head":21,"tail":0}', '{"mode":"delim","delimiter":"","side":"after"}', '{"mode":"surname"}', '{"mode":"x"}', 'nope'] as $r) {
    $check("retention {$r} rejected", in_array('RETENTION', $codes(['retention' => $r]), true));
}

// 通過
$check('8-char Chinese category accepted', [] === $codes(['category' => '教職員工編號代碼'])); // xoops-lint-ignore: test data
$check('lookbehind with quantifier is not nested', [] === $codes(['pattern' => '(?<=學號[:：\s]*)1\d{5,6}(?!\d)'])); // xoops-lint-ignore: test data
$check('escaped parens and classes are literal', [] === $codes(['pattern' => '\(\d+\)[(+*]+']));
$check('fixed-width repeated group accepted', [] === $codes(['pattern' => '(\d{3}-){2}\d{4}']));
$check('alternation repeated a fixed number of times accepted', [] === $codes(['pattern' => '(?:ab|cd){2}']));
foreach (['{"mode":"none"}', '{"mode":"preview"}', '{"mode":"ends","head":3,"tail":0}', '{"mode":"delim","delimiter":"@","side":"after"}'] as $r) {
    $check("retention {$r} accepted", [] === $codes(['retention' => $r]));
}
$check('surname allowed only for 姓名', [] === Rule::validateRetention('{"mode":"surname"}', '姓名')); // xoops-lint-ignore: test data

// spec §6.4 規則包全部通過
foreach (json_decode((string) file_get_contents(dirname(__DIR__) . '/include/rule_pack.json'), true) as $p) {
    $errors = Rule::validate(array_merge(Rule::FIELDS, $p, ['retention' => json_encode($p['retention'])]));
    $check("rule pack {$p['title']} accepted" . ($errors ? ' (' . implode(',', $errors) . ')' : ''), [] === $errors);
}

echo $fail ? "rule_validate_test: {$fail} failed\n" : "rule_validate_test: all passed\n";
exit($fail ? 1 : 0);
