<h4><{if $preset_id}><{$smarty.const._AM_JILLDEID_PRESET_EDIT|escape}><{else}><{$smarty.const._AM_JILLDEID_PRESET_ADD|escape}><{/if}></h4>
<{if $errors}>
<div class="alert alert-danger" role="alert">
    <ul class="mb-0"><{foreach from=$errors item=e}><li><{$e|escape}></li><{/foreach}></ul>
</div>
<{/if}>
<form method="post" action="main.php" id="jill-deid-preset-form">
    <div class="row g-3">
        <div class="col-md-9">
            <label class="form-label" for="title"><{$smarty.const._AM_JILLDEID_TITLE|escape}></label>
            <input class="form-control" type="text" id="title" name="title" maxlength="100" required value="<{$preset.title|escape}>">
        </div>
        <div class="col-md-3">
            <label class="form-label" for="sort"><{$smarty.const._AM_JILLDEID_SORT|escape}></label>
            <input class="form-control" type="number" id="sort" name="sort" min="0" max="65535" value="<{$preset.sort|escape}>">
        </div>
        <div class="col-12">
            <label class="form-label" for="description"><{$smarty.const._AM_JILLDEID_DESCRIPTION|escape}></label>
            <input class="form-control" type="text" id="description" name="description" maxlength="255" value="<{$preset.description|escape}>">
        </div>
        <{foreach from=$choices key=field item=options}>
        <div class="col-md-4">
            <label class="form-label" for="<{$field|escape}>"><{if $field == 'keep_strategy'}><{$smarty.const._AM_JILLDEID_KEEP_STRATEGY|escape}><{elseif $field == 'marker_style'}><{$smarty.const._AM_JILLDEID_MARKER_STYLE|escape}><{else}><{$smarty.const._AM_JILLDEID_HYPERLINK_MODE|escape}><{/if}></label>
            <select class="form-select" id="<{$field|escape}>" name="<{$field|escape}>">
                <{foreach from=$options key=value item=label}>
                <option value="<{$value|escape}>" <{if $preset.$field == $value}>selected<{/if}>><{$label|escape}></option>
                <{/foreach}>
            </select>
        </div>
        <{/foreach}>
        <div class="col-12">
            <label class="form-label" for="custom_config"><{$smarty.const._AM_JILLDEID_CUSTOM_CONFIG|escape}></label>
            <textarea class="form-control font-monospace" id="custom_config" name="custom_config" rows="5" spellcheck="false" aria-describedby="custom_help"><{$preset.custom_config|escape}></textarea>
            <div class="form-text" id="custom_help"><{$smarty.const._AM_JILLDEID_CUSTOM_CONFIG_HELP|escape}></div>
        </div>
        <div class="col-12">
            <div class="form-check form-check-inline">
                <input class="form-check-input" type="checkbox" id="is_default" name="is_default" value="1" <{if $preset.is_default == '1'}>checked<{/if}>>
                <label class="form-check-label" for="is_default"><{$smarty.const._AM_JILLDEID_IS_DEFAULT|escape}></label>
            </div>
            <div class="form-check form-check-inline">
                <input class="form-check-input" type="checkbox" id="enable" name="enable" value="1" <{if $preset.enable == '1'}>checked<{/if}>>
                <label class="form-check-label" for="enable"><{$smarty.const._AM_JILLDEID_ENABLED|escape}></label>
            </div>
        </div>
    </div>
    <div class="mt-4">
        <{$token_form|default:''}>
        <input type="hidden" name="op" value="<{$next_op|escape}>">
        <input type="hidden" name="id" value="<{$preset_id|escape}>">
        <button type="submit" class="btn btn-primary"><i class="fa fa-floppy-disk" aria-hidden="true"></i> <{$smarty.const._AM_JILLDEID_SAVE|escape}></button>
        <a class="btn btn-secondary" href="main.php?op=preset_index"><{$smarty.const._AM_JILLDEID_BACK|escape}></a>
    </div>
</form>
