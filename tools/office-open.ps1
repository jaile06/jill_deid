# Opens each .docx with Microsoft Word and each .xlsx with Excel, without repair and without dialogs
# (spec §9 "Word／Excel 可正常開啟"). Usage: powershell -File tools/office-open.ps1 <file> ...
# Prints "ok <file> (…)" or "FAILED <file>: <reason>"; exit 1 on any failure.
$ErrorActionPreference = 'Stop'
$failed = 0
$docs = @($args | Where-Object { $_ -like '*.docx' })
$books = @($args | Where-Object { $_ -like '*.xlsx' })
if ($docs.Count) {
    $word = New-Object -ComObject Word.Application
    $word.Visible = $false
    $word.DisplayAlerts = 0  # wdAlertsNone: a damaged file raises instead of waiting on a dialog
    try {
        foreach ($path in $docs) {
            $full = [IO.Path]::GetFullPath($path)
            try {
                # FileName, ConfirmConversions, ReadOnly, AddToRecentFiles, …, OpenAndRepair (arg 13) = false
                $doc = $word.Documents.Open($full, $false, $true, $false, '', '', $false, '', '', 0, 0, $false, $false)
                Write-Host "ok $full ($($doc.Paragraphs.Count) paragraphs, $($doc.Hyperlinks.Count) hyperlinks, $($doc.Fields.Count) fields)"
                $doc.Close($false)
            } catch {
                $failed++
                Write-Host "FAILED ${full}: $($_.Exception.Message)"
            }
        }
    } finally {
        $word.Quit()
        [void][Runtime.InteropServices.Marshal]::ReleaseComObject($word)
    }
}
if ($books.Count) {
    $excel = New-Object -ComObject Excel.Application
    $excel.Visible = $false
    $excel.DisplayAlerts = $false
    try {
        foreach ($path in $books) {
            $full = [IO.Path]::GetFullPath($path)
            try {
                # FileName, UpdateLinks 0, ReadOnly; CorruptLoad defaults to xlNormalLoad, so a damaged file raises
                $wb = $excel.Workbooks.Open($full, 0, $true)
                $ws = $wb.Worksheets(1)
                Write-Host "ok $full ($($ws.UsedRange.Rows.Count) rows, $($ws.Hyperlinks.Count) hyperlinks, $($ws.Comments.Count) comments)"
                $wb.Close($false)
            } catch {
                $failed++
                Write-Host "FAILED ${full}: $($_.Exception.Message)"
            }
        }
    } finally {
        $excel.Quit()
        [void][Runtime.InteropServices.Marshal]::ReleaseComObject($excel)
    }
}
exit [int]($failed -gt 0)
