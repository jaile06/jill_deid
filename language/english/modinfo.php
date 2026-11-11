<?php

xoops_loadLanguage('modinfo_common', 'tadtools');

define('_MI_JILLDEID_NAME', 'Document De-identification');
define('_MI_JILLDEID_DESC', 'De-identify and restore documents entirely in the browser; files are never uploaded');
define('_MI_JILLDEID_CREDITS', 'Ported from data-deidentification (dean9703111, MIT)');
define('_MI_JILLDEID_AUTHOR_WEB', 'jill dev notes');
define('_MI_JILLDEID_ADM_RULE', 'Organization rules');
define('_MI_JILLDEID_ADM_PRESET', 'Presets');
define('_MI_JILLDEID_TPL_INDEX', 'Front page');
define('_MI_JILLDEID_TPL_ADMIN', 'Admin frame');
define('_MI_JILLDEID_COLUMN_LABELS', 'Column header labels');
define('_MI_JILLDEID_COLUMN_LABELS_DESC', 'One "label=category" per line. When an Excel or Word table column starts with such a label, the whole column counts as that category.');
define('_MI_JILLDEID_COLUMN_LABELS_DEFAULT', "Name=姓名\nStudent ID=學號\nSeat=座號\nID number=身分證\nBirthday=生日\nMobile=手機\nPhone=市話\nAddress=地址\nEmail=電子郵件\nStaff ID=員編");
