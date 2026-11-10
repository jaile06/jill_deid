<?php

declare(strict_types=1);

/**
 * Checks a HAR against spec §0 INV-1 (spec §9.1). Dev tool; excluded from release by .gitattributes.
 *
 * php tools/check-har.php <file.har> <values.txt> [--since=<ISO 8601>]
 *   values.txt  one original (sample) value per line
 *   --since     when the first file was chosen; defaults to the first request for a format parser or a sample
 *
 * Fails when: a request has a body; a URL or header holds a value (as is or percent-encoded); a request to
 * this module is not a same-site GET; any third-party request starts after --since.
 */

[$harFile, $valuesFile] = array_slice($argv, 1, 2) + [null, null];
if (!$harFile || !$valuesFile) {
    fwrite(STDERR, "usage: php tools/check-har.php <file.har> <values.txt> [--since=<ISO 8601>]\n");
    exit(2);
}
$since = null;
// Milliseconds matter: page-load requests and the first file are often within the same second.
$ms = fn(string $iso): float => (float) (new DateTimeImmutable($iso))->format('U.u');
foreach ($argv as $arg) {
    if (str_starts_with($arg, '--since=')) {
        $since = $ms(substr($arg, 8));
    }
}

$entries = json_decode((string) file_get_contents($harFile), true, 512, JSON_THROW_ON_ERROR)['log']['entries'] ?? [];
$values  = array_values(array_filter(array_map('trim', file($valuesFile) ?: []), fn($v) => $v !== ''));
$forms   = [];
foreach ($values as $v) {
    $enc     = rawurlencode($v);
    $forms[] = ['value' => $v, 'variants' => array_unique([$v, $enc, strtolower($enc), str_replace('%20', '+', $enc)])];
}

$http = array_values(array_filter($entries, fn($e) => preg_match('#^https?://#', $e['request']['url'] ?? '')));
if (!$http) {
    fwrite(STDERR, "no http(s) requests in $harFile\n");
    exit(2);
}
$site = parse_url($http[0]['request']['url'], PHP_URL_HOST);
$time = fn($e) => $ms((string) ($e['startedDateTime'] ?? '@0'));
if ($since === null) {
    foreach ($http as $e) {
        if (preg_match('#/modules/jill_deid/assets/(js/upstream/formats/(docx|xlsx|pdf)\.js|samples/)#', $e['request']['url'])) {
            $since = $time($e);
            break;
        }
    }
}

$fail = [];
foreach ($http as $e) {
    $r    = $e['request'];
    $url  = $r['url'];
    $host = parse_url($url, PHP_URL_HOST);
    if (!empty($r['postData']['text']) || ($r['bodySize'] ?? 0) > 0) {
        $fail[] = "body: {$r['method']} $url";
    }
    $haystack = $url . "\n" . implode("\n", array_map(fn($h) => $h['value'] ?? '', $r['headers'] ?? []));
    foreach ($forms as ['value' => $value, 'variants' => $variants]) {
        foreach ($variants as $f) {
            if (str_contains($haystack, $f)) {
                $fail[] = "value \"$value\" in: $url";
                break;
            }
        }
    }
    if (str_contains((string) parse_url($url, PHP_URL_PATH), '/modules/jill_deid/') && ($host !== $site || $r['method'] !== 'GET')) {
        $fail[] = "module request not a same-site GET: {$r['method']} $url";
    }
    if ($host !== $site && $since !== null && $time($e) >= $since) {
        $fail[] = "third-party request after the first file: $url";
    }
}

printf("%d requests, site %s, first file %s, %d values\n", count($http), $site, $since ? (new DateTimeImmutable('@' . sprintf('%.3f', $since)))->format('H:i:s.v') : 'not found', count($values));
foreach (array_unique($fail) as $f) {
    echo "FAIL $f\n";
}
echo $fail ? "check-har: FAILED\n" : "check-har: passed\n";
exit($fail ? 1 : 0);
