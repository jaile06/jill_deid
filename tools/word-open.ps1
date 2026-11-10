# Opens each .docx with Microsoft Word without repair and without dialogs (spec §9 "Word 可正常開啟").
# Usage: powershell -File tools/word-open.ps1 <file.docx> ...  Prints "ok <file>" or "FAILED <file>: <reason>"; exit 1 on any failure.
$ErrorActionPreference = 'Stop'
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0  # wdAlertsNone: a damaged file raises instead of waiting on a dialog
$failed = 0
try {
    foreach ($path in $args) {
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
exit [int]($failed -gt 0)
