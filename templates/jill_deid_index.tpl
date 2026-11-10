<h3><{$smarty.const._MD_JILLDEID_APP_TITLE|escape}></h3>
<{* Phase 1b：在佈景內直接呼叫函式庫的驗證介面（spec §8），Phase 4 換成 sub_jill_deid_*.tpl *}>
<div id="jill-deid-app">
  <div class="mb-3">
    <label class="form-label" for="jill-deid-smoke-file"><{$smarty.const._MD_JILLDEID_SMOKE_PICK|escape}></label>
    <input class="form-control" type="file" id="jill-deid-smoke-file" multiple>
  </div>
  <div class="form-check mb-3">
    <input class="form-check-input" type="checkbox" id="jill-deid-smoke-ocr">
    <label class="form-check-label" for="jill-deid-smoke-ocr"><{$smarty.const._MD_JILLDEID_SMOKE_OCR|escape}></label>
  </div>
  <table class="table table-sm">
    <thead>
      <tr>
        <th scope="col"><{$smarty.const._MD_JILLDEID_SMOKE_COL_FILE|escape}></th>
        <th scope="col"><{$smarty.const._MD_JILLDEID_SMOKE_COL_FORMAT|escape}></th>
        <th scope="col"><{$smarty.const._MD_JILLDEID_SMOKE_COL_CHARS|escape}></th>
        <th scope="col"><{$smarty.const._MD_JILLDEID_SMOKE_COL_ITEMS|escape}></th>
        <th scope="col"><{$smarty.const._MD_JILLDEID_SMOKE_COL_MS|escape}></th>
        <th scope="col"><{$smarty.const._MD_JILLDEID_SMOKE_COL_OUTPUT|escape}></th>
      </tr>
    </thead>
    <tbody></tbody>
  </table>
  <template id="jill-deid-smoke-row">
    <tr><td></td><td></td><td></td><td></td><td></td><td></td></tr>
  </template>
</div>
