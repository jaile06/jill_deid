<?php

define('_MD_JILLDEID_APP_TITLE', '文件去識別化');
define('_MD_JILLDEID_TABS_LABEL', '功能');
define('_MD_JILLDEID_TAB_PROCESS', '去識別化');
define('_MD_JILLDEID_TAB_PATTERNS', '偵測規則');
define('_MD_JILLDEID_TAB_RESTORE', '還原');
define('_MD_JILLDEID_HELP', '使用說明 ↗');
define('_MD_JILLDEID_HELP_TITLE', '開啟上游專案 data-deidentification 的操作說明（新分頁）');

// 已知不涵蓋範圍（spec §10，MUST 在介面告知）
define('_MD_JILLDEID_LIMITS_TITLE', '自動偵測不保證抓到全部個資，下載前請人工檢查（已知不涵蓋範圍）');
define('_MD_JILLDEID_LIMITS_NAMES', '姓名：依姓氏表與前後文偵測，表外的姓氏（例如武、史、熊、章、尹、崔、賀、俞、靳）不會命中；只有在「姓名」等欄首下的整欄才補得到。');
define('_MD_JILLDEID_LIMITS_ID', '身分證號：只比對第 2 碼為 1、2 的國民身分證，檢核碼錯誤者不命中；居留證號不命中，有外籍師生時請管理者加機構規則。');
define('_MD_JILLDEID_LIMITS_ROSTER', '名冊：欄首標籤偵測不涵蓋合併儲存格造成的欄位錯位、標題跨兩列、沒有標題列的名冊，這類名冊請逐欄檢查。');
define('_MD_JILLDEID_LIMITS_EXCEL', 'Excel：以數值儲存、又不在欄首標籤欄內的電話（開頭的 0 已遺失）；HYPERLINK 以外的公式與其計算結果；工作表名稱；定義名稱。');
define('_MD_JILLDEID_LIMITS_URL', '網址：雙重編碼（%25E7…）、Base64 或自訂編碼的參數值；個人頁網址路徑中的帳號名稱（例如 facebook.com/ 之後的部分）。');
define('_MD_JILLDEID_LIMITS_IMAGES', '圖片：文件內嵌圖片裡的文字（掃描 PDF 經文字辨識重建者除外）。');
define('_MD_JILLDEID_LIMITS_SCOPE', '不支援：.doc、.xls、.pptx 與圖片檔；英文姓名與地址。PDF 輸出不保留超連結。');
