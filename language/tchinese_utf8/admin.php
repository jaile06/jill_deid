<?php

xoops_loadLanguage('admin_common', 'tadtools');

define('_AM_JILLDEID_ADMIN_TITLE', '文件去識別化管理');
define('_AM_JILLDEID_POST_ONLY', '此操作只接受表單送出');

// 共用
define('_AM_JILLDEID_SORT', '排序');
define('_AM_JILLDEID_TITLE', '名稱');
define('_AM_JILLDEID_DESCRIPTION', '說明');
define('_AM_JILLDEID_STATUS', '狀態');
define('_AM_JILLDEID_ACTIONS', '操作');
define('_AM_JILLDEID_ENABLED', '啟用');
define('_AM_JILLDEID_DISABLED', '停用');
define('_AM_JILLDEID_EDIT', '編輯');
define('_AM_JILLDEID_DELETE', '刪除');
define('_AM_JILLDEID_DELETE_CONFIRM', '確定刪除「%s」？');
define('_AM_JILLDEID_CONFIRM_YES', '確定');
define('_AM_JILLDEID_CONFIRM_NO', '取消');
define('_AM_JILLDEID_SAVE', '儲存');
define('_AM_JILLDEID_BACK', '返回列表');

// 機構規則
define('_AM_JILLDEID_RULE_LIST', '機構規則');
define('_AM_JILLDEID_RULE_INTRO', '機構規則會加入每位使用者的偵測規則（前台「偵測規則」頁的「機構共用規則」）。規則以 JavaScript RegExp（旗標 gu）在使用者的瀏覽器執行，文件不會傳到伺服器。');
define('_AM_JILLDEID_RULE_ADD', '新增機構規則');
define('_AM_JILLDEID_RULE_EDIT', '編輯機構規則');
define('_AM_JILLDEID_RULE_EMPTY', '尚無機構規則。可按「匯入校務規則包」加入學號、座號、員編、文號與校務網址參數規則。');
define('_AM_JILLDEID_CATEGORY', '類別');
define('_AM_JILLDEID_CATEGORY_HELP', '1–10 字，不可含空白、[、]、:，也不可與內建類別（姓名、身分證、電子郵件等）或「網址」同名。');
define('_AM_JILLDEID_PATTERN', '比對規則（RegExp）');
define('_AM_JILLDEID_PATTERN_HELP', '例：(?<=學號[:：\s]*)1\d{5,6}(?!\d)。純數字的編號要加標籤上下文，否則會誤遮金額等數字。不可用巢狀量詞、反向引用。');
define('_AM_JILLDEID_SAMPLE', '測試文字');
define('_AM_JILLDEID_SAMPLE_HELP', '只能放虛構範例，不可貼上真實個資：此欄會存進資料庫並顯示給所有使用者。');
define('_AM_JILLDEID_APPLY_TO_URL', '也比對網址');
define('_AM_JILLDEID_LOCKED', '鎖定');
define('_AM_JILLDEID_LOCKED_HELP', '鎖定的規則使用者不能在前台停用（只是操作防呆，不是安全邊界）。');
define('_AM_JILLDEID_RETENTION', '保留方式（部分保留時）');
define('_AM_JILLDEID_RET_NONE', '全部隱藏');
define('_AM_JILLDEID_RET_PREVIEW', '只露出第 1 字');
define('_AM_JILLDEID_RET_ENDS', '保留前／後幾碼');
define('_AM_JILLDEID_RET_DELIM', '以分隔字元為界');
define('_AM_JILLDEID_RET_HEAD', '保留前幾碼');
define('_AM_JILLDEID_RET_TAIL', '保留後幾碼');
define('_AM_JILLDEID_RET_DELIMITER', '分隔字元');
define('_AM_JILLDEID_RET_SIDE', '保留哪一側');
define('_AM_JILLDEID_RET_AFTER', '之後');
define('_AM_JILLDEID_RET_BEFORE', '之前');
define('_AM_JILLDEID_TEST_NOHIT', '測試文字沒有任何命中，請調整規則或測試文字。');
define('_AM_JILLDEID_TEST_SLOW', '規則在大量文字上執行過久（可能回溯失控），請簡化規則。');
define('_AM_JILLDEID_TEST_HITS', '命中：%s');
define('_AM_JILLDEID_PACK_IMPORT', '匯入校務規則包');
define('_AM_JILLDEID_PACK_CONFIRM', '匯入學號、座號、員編、文號、校務網址參數 5 條規則？同名規則會略過。');
define('_AM_JILLDEID_PACK_DONE', '已匯入 %d 條規則，略過 %d 條（同名已存在）');

// 處理情境
define('_AM_JILLDEID_PRESET_LIST', '處理情境');
define('_AM_JILLDEID_PRESET_INTRO', '情境是預先設定好的輸出方式，使用者在前台頂部選擇；預設情境全站只有一筆。');
define('_AM_JILLDEID_PRESET_ADD', '新增處理情境');
define('_AM_JILLDEID_PRESET_EDIT', '編輯處理情境');
define('_AM_JILLDEID_PRESET_EMPTY', '尚無處理情境，前台會使用上游預設（部分保留、編碼）。');
define('_AM_JILLDEID_IS_DEFAULT', '預設');
define('_AM_JILLDEID_KEEP_STRATEGY', '保留方式');
define('_AM_JILLDEID_KEEP_STRATEGY_PARTIAL', '部分保留');
define('_AM_JILLDEID_KEEP_STRATEGY_HIDE_ALL', '全部隱藏');
define('_AM_JILLDEID_KEEP_STRATEGY_CUSTOM', '自訂（依下方逐類別設定）');
define('_AM_JILLDEID_MARKER_STYLE', '標記方式');
define('_AM_JILLDEID_MARKER_STYLE_CODE', '編碼（可還原）');
define('_AM_JILLDEID_MARKER_STYLE_LABEL', '類別（不可還原）');
define('_AM_JILLDEID_MARKER_STYLE_BLANK', '空白佔位 ○（不可還原）');
define('_AM_JILLDEID_HYPERLINK_MODE', '超連結處理');
define('_AM_JILLDEID_HYPERLINK_MODE_MASK_PII_IN_URL', '只遮網址中的個資');
define('_AM_JILLDEID_HYPERLINK_MODE_STRIP_LINK', '含個資的連結整個移除');
define('_AM_JILLDEID_CUSTOM_CONFIG', '自訂：逐類別保留方式（JSON）');
define('_AM_JILLDEID_CUSTOM_CONFIG_HELP', '只在保留方式為「自訂」時使用，例：{"學號": {"mode": "ends", "head": 3, "tail": 0}, "電子郵件": {"mode": "delim", "delimiter": "@", "side": "after"}}。未列出的類別依使用者自己的設定，沒有設定則全部隱藏。');

// 驗證錯誤：_AM_JILLDEID_ERR_<Rule::validate()／Preset::validate() 的代碼>
define('_AM_JILLDEID_ERR_TITLE', '名稱必填，最多 100 字');
define('_AM_JILLDEID_ERR_PATTERN_LENGTH', '比對規則必填，最多 500 字，不可換行');
define('_AM_JILLDEID_ERR_PATTERN_NESTED', '比對規則含巢狀量詞（例如 (a+)+），可能讓瀏覽器卡住');
define('_AM_JILLDEID_ERR_PATTERN_ALT', '比對規則含被重複的交替群組（例如 (a|b)+），可能讓瀏覽器卡住');
define('_AM_JILLDEID_ERR_PATTERN_BACKREF', '比對規則不可使用反向引用（\\1、\\k<名稱>）');
define('_AM_JILLDEID_ERR_PATTERN_EMPTY', '比對規則不可比對到空字串');
define('_AM_JILLDEID_ERR_CATEGORY_FORMAT', '類別須為 1–10 字，不可含空白、[、]、:');
define('_AM_JILLDEID_ERR_CATEGORY_RESERVED', '類別不可與內建類別或「網址」同名');
define('_AM_JILLDEID_ERR_RETENTION', '保留方式設定不正確（保留位數 0–20，分隔字元 1–3 字）');
define('_AM_JILLDEID_ERR_TEXT_LENGTH', '測試文字與說明最多 255 字');
define('_AM_JILLDEID_ERR_FLAG', '選項值不正確');
define('_AM_JILLDEID_ERR_CUSTOM_CONFIG', '逐類別保留方式須為 {"類別": 保留方式} 的 JSON，且每個保留方式都要正確');
