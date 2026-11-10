<h4><{if $rule_id}><{$smarty.const._AM_JILLDEID_RULE_EDIT|escape}><{else}><{$smarty.const._AM_JILLDEID_RULE_ADD|escape}><{/if}></h4>
<{if $errors}>
<div class="alert alert-danger" role="alert">
    <ul class="mb-0"><{foreach from=$errors item=e}><li><{$e|escape}></li><{/foreach}></ul>
</div>
<{/if}>
<form method="post" action="main.php" id="jill-deid-rule-form"
      data-msg-nohit="<{$smarty.const._AM_JILLDEID_TEST_NOHIT|escape}>"
      data-msg-slow="<{$smarty.const._AM_JILLDEID_TEST_SLOW|escape}>"
      data-msg-hits="<{$smarty.const._AM_JILLDEID_TEST_HITS|escape}>">
    <div class="row g-3">
        <div class="col-md-6">
            <label class="form-label" for="title"><{$smarty.const._AM_JILLDEID_TITLE|escape}></label>
            <input class="form-control" type="text" id="title" name="title" maxlength="100" required value="<{$rule.title|escape}>">
        </div>
        <div class="col-md-3">
            <label class="form-label" for="category"><{$smarty.const._AM_JILLDEID_CATEGORY|escape}></label>
            <input class="form-control" type="text" id="category" name="category" maxlength="10" required value="<{$rule.category|escape}>" aria-describedby="category_help">
            <div class="form-text" id="category_help"><{$smarty.const._AM_JILLDEID_CATEGORY_HELP|escape}></div>
        </div>
        <div class="col-md-3">
            <label class="form-label" for="sort"><{$smarty.const._AM_JILLDEID_SORT|escape}></label>
            <input class="form-control" type="number" id="sort" name="sort" min="0" max="65535" value="<{$rule.sort|escape}>">
        </div>
        <div class="col-12">
            <label class="form-label" for="pattern"><{$smarty.const._AM_JILLDEID_PATTERN|escape}></label>
            <input class="form-control font-monospace" type="text" id="pattern" name="pattern" maxlength="500" required spellcheck="false" autocomplete="off" value="<{$rule.pattern|escape}>" aria-describedby="pattern_help">
            <div class="form-text" id="pattern_help"><{$smarty.const._AM_JILLDEID_PATTERN_HELP|escape}></div>
        </div>
        <div class="col-12">
            <label class="form-label" for="sample_text"><{$smarty.const._AM_JILLDEID_SAMPLE|escape}></label>
            <input class="form-control" type="text" id="sample_text" name="sample_text" maxlength="255" required value="<{$rule.sample_text|escape}>" aria-describedby="sample_help jill-deid-rule-test">
            <div class="form-text" id="sample_help"><{$smarty.const._AM_JILLDEID_SAMPLE_HELP|escape}></div>
            <div id="jill-deid-rule-test" class="small mt-1" aria-live="polite"></div>
        </div>
        <fieldset class="col-12">
            <legend class="form-label fs-6"><{$smarty.const._AM_JILLDEID_RETENTION|escape}></legend>
            <input type="hidden" name="retention" value="<{$rule.retention|escape}>">
            <div class="row g-2 align-items-end">
                <div class="col-md-4">
                    <label class="visually-hidden" for="ret_mode"><{$smarty.const._AM_JILLDEID_RETENTION|escape}></label>
                    <select class="form-select" id="ret_mode" name="ret_mode">
                        <option value="none"><{$smarty.const._AM_JILLDEID_RET_NONE|escape}></option>
                        <option value="preview"><{$smarty.const._AM_JILLDEID_RET_PREVIEW|escape}></option>
                        <option value="ends"><{$smarty.const._AM_JILLDEID_RET_ENDS|escape}></option>
                        <option value="delim"><{$smarty.const._AM_JILLDEID_RET_DELIM|escape}></option>
                    </select>
                </div>
                <div class="col-md-2" data-ret="ends">
                    <label class="form-label" for="ret_head"><{$smarty.const._AM_JILLDEID_RET_HEAD|escape}></label>
                    <input class="form-control" type="number" id="ret_head" name="ret_head" min="0" max="20" value="0">
                </div>
                <div class="col-md-2" data-ret="ends">
                    <label class="form-label" for="ret_tail"><{$smarty.const._AM_JILLDEID_RET_TAIL|escape}></label>
                    <input class="form-control" type="number" id="ret_tail" name="ret_tail" min="0" max="20" value="0">
                </div>
                <div class="col-md-2" data-ret="delim">
                    <label class="form-label" for="ret_delimiter"><{$smarty.const._AM_JILLDEID_RET_DELIMITER|escape}></label>
                    <input class="form-control" type="text" id="ret_delimiter" name="ret_delimiter" maxlength="3" value="@">
                </div>
                <div class="col-md-2" data-ret="delim">
                    <label class="form-label" for="ret_side"><{$smarty.const._AM_JILLDEID_RET_SIDE|escape}></label>
                    <select class="form-select" id="ret_side" name="ret_side">
                        <option value="after"><{$smarty.const._AM_JILLDEID_RET_AFTER|escape}></option>
                        <option value="before"><{$smarty.const._AM_JILLDEID_RET_BEFORE|escape}></option>
                    </select>
                </div>
            </div>
        </fieldset>
        <div class="col-12">
            <label class="form-label" for="description"><{$smarty.const._AM_JILLDEID_DESCRIPTION|escape}></label>
            <input class="form-control" type="text" id="description" name="description" maxlength="255" value="<{$rule.description|escape}>">
        </div>
        <div class="col-12">
            <div class="form-check form-check-inline">
                <input class="form-check-input" type="checkbox" id="apply_to_url" name="apply_to_url" value="1" <{if $rule.apply_to_url == '1'}>checked<{/if}>>
                <label class="form-check-label" for="apply_to_url"><{$smarty.const._AM_JILLDEID_APPLY_TO_URL|escape}></label>
            </div>
            <div class="form-check form-check-inline">
                <input class="form-check-input" type="checkbox" id="locked" name="locked" value="1" <{if $rule.locked == '1'}>checked<{/if}> aria-describedby="locked_help">
                <label class="form-check-label" for="locked"><{$smarty.const._AM_JILLDEID_LOCKED|escape}></label>
            </div>
            <div class="form-check form-check-inline">
                <input class="form-check-input" type="checkbox" id="enable" name="enable" value="1" <{if $rule.enable == '1'}>checked<{/if}>>
                <label class="form-check-label" for="enable"><{$smarty.const._AM_JILLDEID_ENABLED|escape}></label>
            </div>
            <div class="form-text" id="locked_help"><{$smarty.const._AM_JILLDEID_LOCKED_HELP|escape}></div>
        </div>
    </div>
    <div class="mt-4">
        <{$token_form|default:''}>
        <input type="hidden" name="op" value="<{$next_op|escape}>">
        <input type="hidden" name="id" value="<{$rule_id|escape}>">
        <button type="submit" class="btn btn-primary"><i class="fa fa-floppy-disk" aria-hidden="true"></i> <{$smarty.const._AM_JILLDEID_SAVE|escape}></button>
        <a class="btn btn-secondary" href="main.php?op=rule_index"><{$smarty.const._AM_JILLDEID_BACK|escape}></a>
    </div>
</form>
