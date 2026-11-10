# Builds tests/browser/fixtures/links.docx with Microsoft Word (spec §5.5 DOCX, Phase 3b-3). All values are fictitious.
#   hyperlink       點此查看 → https://school.edu.tw/s?id=A123456789&name=%E7%8E%8B%E5%B0%8F%E6%98%8E
#   hyperlink       王小明 → mailto:wang.xm@school.edu.tw, ScreenTip 聯絡王小明
#   field code      HYPERLINK "mailto:chen.ml@school.edu.tw" (shown as 寫信)
#   header link     個人頁 → https://www.facebook.com/wang.xiaoming
#   footnote        身分證 A123456789; comment 請林志明確認; author 測試作者
# Same author handling as make-h15.ps1. Saved as UTF-8 with BOM for Windows PowerShell 5.1.
$ErrorActionPreference = 'Stop'
$out = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\tests\browser\fixtures\links.docx'))

$word = New-Object -ComObject Word.Application
$word.Visible = $false
$real = $word.UserName, $word.UserInitials, $word.Options.UseLocalUserInfo
$word.UserName, $word.UserInitials, $word.Options.UseLocalUserInfo = '測試作者', 'TA', $true
try {
    $doc = $word.Documents.Add()
    $doc.Content.Text = "第一段：點此查看`r第二段：王小明`r第三段：寫信`r第四段：註腳"
    $p = { param($i) $doc.Paragraphs($i).Range }
    $r = (& $p 1); $r.SetRange($r.Start + 4, $r.End - 1)
    $doc.Hyperlinks.Add($r, 'https://school.edu.tw/s?id=A123456789&name=%E7%8E%8B%E5%B0%8F%E6%98%8E') | Out-Null
    $r = (& $p 2); $r.SetRange($r.Start + 4, $r.End - 1)
    $doc.Hyperlinks.Add($r, 'mailto:wang.xm@school.edu.tw', [Type]::Missing, '聯絡王小明') | Out-Null
    $r = (& $p 3); $r.SetRange($r.Start + 4, $r.End - 1)
    $r.Text = ''
    $f = $doc.Fields.Add($r, -1, 'HYPERLINK "mailto:chen.ml@school.edu.tw"', $false)  # wdFieldEmpty
    $f.Result.Text = '寫信'
    $r = (& $p 4); $r.SetRange($r.End - 1, $r.End - 1)
    $doc.Footnotes.Add($r, [Type]::Missing, '身分證 A123456789') | Out-Null
    $doc.Comments.Add((& $p 1), '請林志明確認') | Out-Null
    $h = $doc.Sections(1).Headers(1).Range  # wdHeaderFooterPrimary
    $h.Text = '個人頁'
    $doc.Hyperlinks.Add($h, 'https://www.facebook.com/wang.xiaoming') | Out-Null
    $doc.SaveAs2($out, 16)
    $doc.Close($false)
} finally {
    $word.UserName, $word.UserInitials, $word.Options.UseLocalUserInfo = $real
    $word.Quit()
    [void][Runtime.InteropServices.Marshal]::ReleaseComObject($word)
}
Write-Host "wrote $out"
