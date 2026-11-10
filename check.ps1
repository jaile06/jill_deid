# Run before merging each phase: php -l, xoops-lint, PHP rule tests
$ErrorActionPreference = 'Stop'
$php  = 'E:\my_xoops274\core\php83\php.exe'
$root = $PSScriptRoot
$fail = 0

Get-ChildItem $root -Recurse -Filter *.php | Where-Object { $_.FullName -notmatch '\\(vendor|node_modules)\\' } | ForEach-Object {
    $out = & $php -l $_.FullName 2>&1
    if ($LASTEXITCODE -ne 0) { Write-Host $out; $fail++ }
}

& $php D:/workspace/02_Tools/xoops-lint/xoops-lint.php $root
if ($LASTEXITCODE -ne 0) { $fail++ }

Get-ChildItem "$root\tests" -Filter *_test.php -ErrorAction SilentlyContinue | ForEach-Object {
    & $php $_.FullName
    if ($LASTEXITCODE -ne 0) { $fail++ }
}

# Browser test page (spec §9.2) through headless Chrome; needs the local site at $url
$chrome = 'C:\Program Files\Google\Chrome\Application\chrome.exe'
$url = if ($env:JILL_DEID_TEST_URL) { $env:JILL_DEID_TEST_URL } else { 'http://localhost/modules/jill_deid/tests/browser/index.html' }
if (Test-Path $chrome) {
    $dom = & $chrome --headless=new --disable-gpu --no-first-run --log-level=3 "--user-data-dir=$env:TEMP\jill_deid_chrome" --virtual-time-budget=600000 --dump-dom $url | Out-String
    ([regex]::Matches($dom, '<li[^>]*>([^<]*)</li>') | ForEach-Object { $_.Groups[1].Value }) -match '^FAIL' | ForEach-Object { Write-Host $_ -ForegroundColor Red }
    if ($dom -notmatch '<title>PASS</title>') { Write-Host "browser tests: $([regex]::Match($dom, '<title>([^<]*)').Groups[1].Value) ($url)"; $fail++ }
} else { Write-Host "browser tests: Chrome not found at $chrome"; $fail++ }

if ($fail) { Write-Host "check.ps1: $fail check(s) failed" -ForegroundColor Red; exit 1 }
Write-Host 'check.ps1: all passed' -ForegroundColor Green
