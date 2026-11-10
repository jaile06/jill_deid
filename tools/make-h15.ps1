# Builds tests/browser/fixtures/h15.docx with Microsoft Word (spec §9.2 H15). All values are fictitious.
#   text box        王小明 A123456789   (Word also saves a VML copy of it in mc:Fallback)
#   tracked delete  陳美玲 B200000004   (kept in the file as w:del / w:delText)
#   kept paragraph  林志明
#   author          測試作者           (docProps and w:del w:author; spec §5.5 DOCX 6–7)
# Saved as UTF-8 with BOM so Windows PowerShell 5.1 reads the Chinese literals correctly.
$ErrorActionPreference = 'Stop'
$out = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\tests\browser\fixtures\h15.docx'))
New-Item -ItemType Directory -Force (Split-Path $out) | Out-Null

$word = New-Object -ComObject Word.Application
$word.Visible = $false
# Word writes its user name into docProps and every revision; use a fictitious one, then restore yours.
# UseLocalUserInfo: without it a signed-in Office account overrides UserName.
$real = $word.UserName, $word.UserInitials, $word.Options.UseLocalUserInfo
$word.UserName, $word.UserInitials, $word.Options.UseLocalUserInfo = '測試作者', 'TA', $true
try {
    $doc = $word.Documents.Add()
    $doc.Content.Text = "保留段落：聯絡人林志明。`r刪除段落：導師陳美玲，身分證 B200000004。"
    $box = $doc.Shapes.AddTextbox(1, 100, 150, 260, 60)  # msoTextOrientationHorizontal
    $box.TextFrame.TextRange.Text = '文字方塊：王小明 A123456789'
    $doc.TrackRevisions = $true
    $doc.Paragraphs(2).Range.Delete() | Out-Null
    $doc.SaveAs2($out, 16)  # wdFormatDocumentDefault (.docx)
    $doc.Close($false)
} finally {
    $word.UserName, $word.UserInitials, $word.Options.UseLocalUserInfo = $real
    $word.Quit()
    [void][Runtime.InteropServices.Marshal]::ReleaseComObject($word)
}
Write-Host "wrote $out"
