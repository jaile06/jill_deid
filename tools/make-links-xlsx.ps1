# Builds tests/browser/fixtures/links.xlsx with Microsoft Excel (spec §5.5 XLSX, Phase 3b-4). All values are fictitious.
#   A1 王小明      hyperlink mailto:wang.xm@school.edu.tw, ScreenTip 聯絡王小明, comment 請林志明確認
#   A2 點此查看    hyperlink https://school.edu.tw/s?id=A123456789&name=%E7%8E%8B%E5%B0%8F%E6%98%8E
#   A3            =HYPERLINK("mailto:chen.ml@school.edu.tw","陳美玲")
#   author        測試作者 (Application.UserName, restored afterwards)
# No threaded comment: Excel signs those with the Office account, which would put a real name in the fixture.
# Saved as UTF-8 with BOM for Windows PowerShell 5.1.
$ErrorActionPreference = 'Stop'
$out = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\tests\browser\fixtures\links.xlsx'))

$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
$real = $excel.UserName
$excel.UserName = '測試作者'
try {
    $wb = $excel.Workbooks.Add()
    $ws = $wb.Worksheets(1)
    $ws.Range('A1').Value2 = '王小明'
    $ws.Hyperlinks.Add($ws.Range('A1'), 'mailto:wang.xm@school.edu.tw', [Type]::Missing, '聯絡王小明') | Out-Null
    $ws.Range('A1').AddComment('請林志明確認') | Out-Null
    $ws.Range('A2').Value2 = '點此查看'
    $ws.Hyperlinks.Add($ws.Range('A2'), 'https://school.edu.tw/s?id=A123456789&name=%E7%8E%8B%E5%B0%8F%E6%98%8E') | Out-Null
    $ws.Range('A3').Formula = '=HYPERLINK("mailto:chen.ml@school.edu.tw","陳美玲")'
    # The Author property comes from the Office account, not UserName: set it (and Last Author) explicitly.
    # Late-bound COM collections need InvokeMember from PowerShell.
    $props = $wb.BuiltinDocumentProperties
    foreach ($name in 'Author', 'Last Author') {
        $p = [System.__ComObject].InvokeMember('Item', [Reflection.BindingFlags]::GetProperty, $null, $props, @($name))
        [System.__ComObject].InvokeMember('Value', [Reflection.BindingFlags]::SetProperty, $null, $p, @('測試作者'))
    }
    if (Test-Path $out) { Remove-Item $out }
    $wb.SaveAs($out, 51)  # xlOpenXMLWorkbook
    $wb.Close($false)
} finally {
    $excel.UserName = $real
    $excel.Quit()
    [void][Runtime.InteropServices.Marshal]::ReleaseComObject($excel)
}

# Excel writes the signed-in account as lastModifiedBy on save, whatever Last Author says: replace it in the file,
# then make sure that name appears nowhere else in the package (the name itself is never printed).
Add-Type -AssemblyName System.IO.Compression.FileSystem
$utf8 = New-Object Text.UTF8Encoding $false
$zip = [IO.Compression.ZipFile]::Open($out, 'Update')
try {
    $entry = $zip.GetEntry('docProps/core.xml')
    $reader = New-Object IO.StreamReader($entry.Open(), $utf8)
    $xml = $reader.ReadToEnd()
    $reader.Close()
    $account = [regex]::Match($xml, '<cp:lastModifiedBy>([^<]*)</cp:lastModifiedBy>').Groups[1].Value
    $xml = [regex]::Replace($xml, '<cp:lastModifiedBy>[^<]*</cp:lastModifiedBy>', '<cp:lastModifiedBy>測試作者</cp:lastModifiedBy>')
    $entry.Delete()
    $writer = New-Object IO.StreamWriter($zip.CreateEntry('docProps/core.xml').Open(), $utf8)
    $writer.Write($xml)
    $writer.Close()
    if ($account -and $account -ne '測試作者') {
        foreach ($e in $zip.Entries) {
            $r = New-Object IO.StreamReader($e.Open(), $utf8)
            $found = $r.ReadToEnd().Contains($account)
            $r.Close()
            if ($found) { throw "the Office account name is still in $($e.FullName)" }
        }
    }
} finally {
    $zip.Dispose()
}
Write-Host "wrote $out"
