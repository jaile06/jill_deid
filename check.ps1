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

if ($fail) { Write-Host "check.ps1: $fail check(s) failed" -ForegroundColor Red; exit 1 }
Write-Host 'check.ps1: all passed' -ForegroundColor Green
