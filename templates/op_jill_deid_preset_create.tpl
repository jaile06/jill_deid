

<!--套用formValidator驗證機制-->
<form action="<{$smarty.server.SCRIPT_NAME}>" method="post" id="myForm" enctype="multipart/form-data">
    <div class="row">

        <!--方案名稱-->
        <div class="col-md-12">
            <div class="form-floating mb-3">
                <input type="text" name="title" id="title" class="form-control validate[required]" value="<{$title}>" placeholder="<{$smarty.const._MD_JILLDEID_PRESET_TITLE}>">
                <label for="title"><{$smarty.const._MD_JILLDEID_PRESET_TITLE}></label>
            </div>
        </div>

        <!--說明-->
        <div class="col-md-12">
            <div class="form-floating mb-3">
                <input type="text" name="description" id="description" class="form-control validate[required, minSize[1]]" value="<{$description}>" placeholder="<{$smarty.const._MD_JILLDEID_PRESET_DESCRIPTION}>">
                <label for="description"><{$smarty.const._MD_JILLDEID_PRESET_DESCRIPTION}></label>
            </div>
        </div>

    <!--保留策略-->
    <div class="row">
        <div class="col-md-2" id="keep_strategy_label">
            <{$smarty.const._MD_JILLDEID_PRESET_KEEP_STRATEGY}>
        </div>
        <div class="col-md-10" role="group" aria-labelledby="keep_strategy_label">
            <div class="form-check form-check-inline pt-2">
                <input type="radio" name="keep_strategy" id="keep_strategy_partial" class="form-check-input" value="partial" <{if $keep_strategy == "partial"}>checked="checked"<{/if}>>
                <label class="form-check-label" for="keep_strategy_partial">partial</label>
            </div>
            <div class="form-check form-check-inline pt-2">
                <input type="radio" name="keep_strategy" id="keep_strategy_hide_all" class="form-check-input" value="hide_all" <{if $keep_strategy == "hide_all"}>checked="checked"<{/if}>>
                <label class="form-check-label" for="keep_strategy_hide_all">hide_all</label>
            </div>
            <div class="form-check form-check-inline pt-2">
                <input type="radio" name="keep_strategy" id="keep_strategy_custom" class="form-check-input" value="custom" <{if $keep_strategy == "custom"}>checked="checked"<{/if}>>
                <label class="form-check-label" for="keep_strategy_custom">custom</label>
            </div>
        </div>
    </div>

    <!--遮罩標記樣式-->
    <div class="row">
        <div class="col-md-2" id="marker_style_label">
            <{$smarty.const._MD_JILLDEID_PRESET_MARKER_STYLE}>
        </div>
        <div class="col-md-10" role="group" aria-labelledby="marker_style_label">
            <div class="form-check form-check-inline pt-2">
                <input type="radio" name="marker_style" id="marker_style_code" class="form-check-input" value="code" <{if $marker_style == "code"}>checked="checked"<{/if}>>
                <label class="form-check-label" for="marker_style_code">code</label>
            </div>
            <div class="form-check form-check-inline pt-2">
                <input type="radio" name="marker_style" id="marker_style_label" class="form-check-input" value="label" <{if $marker_style == "label"}>checked="checked"<{/if}>>
                <label class="form-check-label" for="marker_style_label">label</label>
            </div>
            <div class="form-check form-check-inline pt-2">
                <input type="radio" name="marker_style" id="marker_style_blank" class="form-check-input" value="blank" <{if $marker_style == "blank"}>checked="checked"<{/if}>>
                <label class="form-check-label" for="marker_style_blank">blank</label>
            </div>
        </div>
    </div>

    <!--超連結處理方式-->
    <div class="row">
        <div class="col-md-2" id="hyperlink_mode_label">
            <{$smarty.const._MD_JILLDEID_PRESET_HYPERLINK_MODE}>
        </div>
        <div class="col-md-10" role="group" aria-labelledby="hyperlink_mode_label">
            <div class="form-check form-check-inline pt-2">
                <input type="radio" name="hyperlink_mode" id="hyperlink_mode_mask_pii_in_url" class="form-check-input" value="mask_pii_in_url" <{if $hyperlink_mode == "mask_pii_in_url"}>checked="checked"<{/if}>>
                <label class="form-check-label" for="hyperlink_mode_mask_pii_in_url">mask_pii_in_url</label>
            </div>
            <div class="form-check form-check-inline pt-2">
                <input type="radio" name="hyperlink_mode" id="hyperlink_mode_strip_link" class="form-check-input" value="strip_link" <{if $hyperlink_mode == "strip_link"}>checked="checked"<{/if}>>
                <label class="form-check-label" for="hyperlink_mode_strip_link">strip_link</label>
            </div>
        </div>
    </div>

        <!--自訂設定-->
        <div class="col-md-12">
            <div class="form-floating mb-3">
                <textarea name="custom_config" rows=8 id="custom_config" class="form-control " placeholder="<{$smarty.const._MD_JILLDEID_PRESET_CUSTOM_CONFIG}>"><{$custom_config}></textarea>
                <label for="custom_config"><{$smarty.const._MD_JILLDEID_PRESET_CUSTOM_CONFIG}></label>
            </div>
        </div>

        <!--是否為預設-->
        <div class="col-md-1">
            <div class="form-check form-switch">
                <input type="hidden" name="is_default" value="0">
                <input type="checkbox" name="is_default" role="switch" id="is_default_0" class="form-check-input" value="1" <{if $is_default == '1'}>checked="checked"<{/if}>>
                <label class="form-check-label" for="is_default_0"><{$smarty.const._MD_JILLDEID_PRESET_IS_DEFAULT}></label>
            </div>
        </div>

        <!--是否啟用-->
        <div class="col-md-1">
            <div class="form-check form-switch">
                <input type="hidden" name="enable" value="0">
                <input type="checkbox" name="enable" role="switch" id="enable_0" class="form-check-input" value="1" <{if $enable == '1'}>checked="checked"<{/if}>>
                <label class="form-check-label" for="enable_0"><{$smarty.const._MD_JILLDEID_PRESET_ENABLE}></label>
            </div>
        </div>

        <!--排序-->
        <div class="col-md-6">
            <div class="form-floating mb-3">
                <input type="text" name="sort" id="sort" class="form-control " value="<{$sort}>" placeholder="<{$smarty.const._MD_JILLDEID_PRESET_SORT}>">
                <label for="sort"><{$smarty.const._MD_JILLDEID_PRESET_SORT}></label>
            </div>
        </div>
    </div>

    <div class="bar text-center">
        
        <!--編號-->
        <input type='hidden' name="id" value="<{$id}>">
        <{$token_form|default:''}>
        <input type="hidden" name="op" value="<{$next_op|default:''}>">
        <input type="hidden" name="id" value="<{$id}>">
    
        <button type="submit" class="btn btn-primary"><i class="fa fa-floppy-disk" aria-hidden="true"></i> <{$smarty.const._TAD_SAVE}></button>
    </div>
</form>
