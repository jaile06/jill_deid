

<!--套用formValidator驗證機制-->
<form action="<{$smarty.server.SCRIPT_NAME}>" method="post" id="myForm" enctype="multipart/form-data">
    <div class="row">

        <!--規則名稱-->
        <div class="col-md-12">
            <div class="form-floating mb-3">
                <input type="text" name="title" id="title" class="form-control validate[required]" value="<{$title}>" placeholder="<{$smarty.const._MA_JILLDEID_RULE_TITLE}>">
                <label for="title"><{$smarty.const._MA_JILLDEID_RULE_TITLE}></label>
            </div>
        </div>

    <!--類別-->
    <div class="row">
        <div class="col-md-2" id="category_label">
            <{$smarty.const._MA_JILLDEID_RULE_CATEGORY}>
        </div>
        <div class="col-md-10" role="group" aria-labelledby="category_label">
            <div class="form-check form-check-inline pt-2">
                <input type="radio" name="category" id="category_1" class="form-check-input" value="1" <{if $category == "1"}>checked="checked"<{/if}>>
                <label class="form-check-label" for="category_1"><{$smarty.const._YES}></label>
            </div>
            <div class="form-check form-check-inline pt-2">
                <input type="radio" name="category" id="category_0" class="form-check-input" value="0" <{if $category == "0"}>checked="checked"<{/if}>>
                <label class="form-check-label" for="category_0"><{$smarty.const._NO}></label>
            </div>
        </div>
    </div>

        <!--比對規則-->
        <div class="col-md-12">
            <div class="form-floating mb-3">
                <input type="text" name="pattern" id="pattern" class="form-control " value="<{$pattern}>" placeholder="<{$smarty.const._MA_JILLDEID_RULE_PATTERN}>">
                <label for="pattern"><{$smarty.const._MA_JILLDEID_RULE_PATTERN}></label>
            </div>
        </div>

        <!--套用於網址-->
        <div class="col-md-1">
            <div class="form-check form-switch">
                <input type="hidden" name="apply_to_url" value="0">
                <input type="checkbox" name="apply_to_url" role="switch" id="apply_to_url_0" class="form-check-input" value="1" <{if $apply_to_url == '1'}>checked="checked"<{/if}>>
                <label class="form-check-label" for="apply_to_url_0"><{$smarty.const._MA_JILLDEID_RULE_APPLY_TO_URL}></label>
            </div>
        </div>

        <!--保留設定-->
        <div class="col-md-12">
            <div class="form-floating mb-3">
                <input type="text" name="retention" id="retention" class="form-control " value="<{$retention}>" placeholder="<{$smarty.const._MA_JILLDEID_RULE_RETENTION}>">
                <label for="retention"><{$smarty.const._MA_JILLDEID_RULE_RETENTION}></label>
            </div>
        </div>

        <!--範例文字-->
        <div class="col-md-12">
            <div class="form-floating mb-3">
                <input type="text" name="sample_text" id="sample_text" class="form-control " value="<{$sample_text}>" placeholder="<{$smarty.const._MA_JILLDEID_RULE_SAMPLE_TEXT}>">
                <label for="sample_text"><{$smarty.const._MA_JILLDEID_RULE_SAMPLE_TEXT}></label>
            </div>
        </div>

        <!--說明-->
        <div class="col-md-12">
            <div class="form-floating mb-3">
                <input type="text" name="description" id="description" class="form-control " value="<{$description}>" placeholder="<{$smarty.const._MA_JILLDEID_RULE_DESCRIPTION}>">
                <label for="description"><{$smarty.const._MA_JILLDEID_RULE_DESCRIPTION}></label>
            </div>
        </div>

        <!--是否鎖定-->
        <div class="col-md-1">
            <div class="form-check form-switch">
                <input type="hidden" name="locked" value="0">
                <input type="checkbox" name="locked" role="switch" id="locked_0" class="form-check-input" value="1" <{if $locked == '1'}>checked="checked"<{/if}>>
                <label class="form-check-label" for="locked_0"><{$smarty.const._MA_JILLDEID_RULE_LOCKED}></label>
            </div>
        </div>

        <!--是否啟用-->
        <div class="col-md-1">
            <div class="form-check form-switch">
                <input type="hidden" name="enable" value="0">
                <input type="checkbox" name="enable" role="switch" id="enable_0" class="form-check-input" value="1" <{if $enable == '1'}>checked="checked"<{/if}>>
                <label class="form-check-label" for="enable_0"><{$smarty.const._MA_JILLDEID_RULE_ENABLE}></label>
            </div>
        </div>

        <!--排序-->
        <div class="col-md-6">
            <div class="form-floating mb-3">
                <input type="text" name="sort" id="sort" class="form-control " value="<{$sort}>" placeholder="<{$smarty.const._MA_JILLDEID_RULE_SORT}>">
                <label for="sort"><{$smarty.const._MA_JILLDEID_RULE_SORT}></label>
            </div>
        </div>
    </div>

    <div class="bar text-center">
        
        <!--修改者-->
        <input type='hidden' name="uid" value="<{$uid}>">
        <{$token_form|default:''}>
        <input type="hidden" name="op" value="<{$next_op|default:''}>">
        <input type="hidden" name="id" value="<{$id}>">
    
        <button type="submit" class="btn btn-primary"><i class="fa fa-floppy-disk" aria-hidden="true"></i> <{$smarty.const._TAD_SAVE}></button>
    </div>
</form>
