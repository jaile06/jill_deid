<h3><{$smarty.const._MD_JILLDEID_APP_TITLE|escape}></h3>
<div id="jill-deid-app" translate="no" class="notranslate">
  <nav class="tabs" aria-label="<{$smarty.const._MD_JILLDEID_TABS_LABEL|escape}>">
    <button type="button" class="tab" data-tab="process"><{$smarty.const._MD_JILLDEID_TAB_PROCESS|escape}></button>
    <button type="button" class="tab" data-tab="patterns"><{$smarty.const._MD_JILLDEID_TAB_PATTERNS|escape}></button>
    <button type="button" class="tab" data-tab="restore"><{$smarty.const._MD_JILLDEID_TAB_RESTORE|escape}></button>
    <a class="tab tab-link" href="https://github.com/dean9703111/data-deidentification#%E6%93%8D%E4%BD%9C%E6%B5%81%E7%A8%8B" target="_blank" rel="noopener" title="<{$smarty.const._MD_JILLDEID_HELP_TITLE|escape}>"><{$smarty.const._MD_JILLDEID_HELP|escape}></a>
  </nav>
  <{* 已知不涵蓋範圍（spec §6.1 新增 6、§10 MUST）：摘要一直顯示，展開看明細 *}>
  <details class="known-limits">
    <summary><{$smarty.const._MD_JILLDEID_LIMITS_TITLE|escape}></summary>
    <ul>
      <li><{$smarty.const._MD_JILLDEID_LIMITS_NAMES|escape}></li>
      <li><{$smarty.const._MD_JILLDEID_LIMITS_ID|escape}></li>
      <li><{$smarty.const._MD_JILLDEID_LIMITS_ROSTER|escape}></li>
      <li><{$smarty.const._MD_JILLDEID_LIMITS_EXCEL|escape}></li>
      <li><{$smarty.const._MD_JILLDEID_LIMITS_URL|escape}></li>
      <li><{$smarty.const._MD_JILLDEID_LIMITS_IMAGES|escape}></li>
      <li><{$smarty.const._MD_JILLDEID_LIMITS_SCOPE|escape}></li>
    </ul>
  </details>
  <div class="panels"></div>
</div>
<{* 設定 JSON（spec §7）：json_encode 已用 JSON_HEX_TAG 等旗標，直接輸出 *}>
<script type="application/json" id="jill-deid-config"><{$deid_config_json}></script>
