<?php

define('_MD_JILLDEID_APP_TITLE', 'Document De-identification');
define('_MD_JILLDEID_TABS_LABEL', 'Functions');
define('_MD_JILLDEID_TAB_PROCESS', 'De-identify');
define('_MD_JILLDEID_TAB_PATTERNS', 'Detection rules');
define('_MD_JILLDEID_TAB_RESTORE', 'Restore');
define('_MD_JILLDEID_HELP', 'User guide ↗');
define('_MD_JILLDEID_HELP_TITLE', 'Open the upstream data-deidentification guide (new tab)');

// Known gaps (spec §10, MUST be shown in the interface)
define('_MD_JILLDEID_LIMITS_TITLE', 'Detection cannot promise to find every piece of personal data: check the result before downloading (known gaps)');
define('_MD_JILLDEID_LIMITS_NAMES', 'Names: found by a surname list and context; surnames outside the list (e.g. 武, 史, 熊, 章, 尹, 崔, 賀, 俞, 靳) are missed, except in a whole column under a header such as 姓名.');
define('_MD_JILLDEID_LIMITS_ID', 'ID numbers: only national IDs whose second digit is 1 or 2, with a valid check digit; resident permit numbers are missed. Ask the administrator for an organisation rule if needed.');
define('_MD_JILLDEID_LIMITS_ROSTER', 'Rosters: column-header detection misses columns shifted by merged cells, headers over two rows and rosters without a header row; check such rosters column by column.');
define('_MD_JILLDEID_LIMITS_EXCEL', 'Excel: phone numbers stored as numbers outside a labelled column (the leading 0 is lost); formulas other than HYPERLINK and their results; sheet names; defined names.');
define('_MD_JILLDEID_LIMITS_URL', 'URLs: double-encoded (%25E7…), Base64 or custom-encoded parameter values; account names in the path of personal pages (e.g. after facebook.com/).');
define('_MD_JILLDEID_LIMITS_IMAGES', 'Images: text inside embedded pictures (scanned PDFs rebuilt by text recognition excepted).');
define('_MD_JILLDEID_LIMITS_SCOPE', 'Not supported: .doc, .xls, .pptx and image files; English names and addresses. PDF output keeps no hyperlinks.');
