<h4><{$smarty.const._AM_JILLDEID_RULE_LIST|escape}></h4>
<p class="text-muted"><{$smarty.const._AM_JILLDEID_RULE_INTRO|escape}></p>
<div class="mb-3">
    <a class="btn btn-primary" href="main.php?op=rule_create"><i class="fa fa-plus" aria-hidden="true"></i> <{$smarty.const._AM_JILLDEID_RULE_ADD|escape}></a>
    <button type="button" class="btn btn-outline-primary jill-deid-post" data-op="rule_import_pack" data-confirm="<{$smarty.const._AM_JILLDEID_PACK_CONFIRM|escape}>"><i class="fa fa-file-import" aria-hidden="true"></i> <{$smarty.const._AM_JILLDEID_PACK_IMPORT|escape}></button>
</div>
<{if $rules}>
<div class="table-responsive">
    <table class="table table-striped table-hover align-middle">
        <caption class="visually-hidden"><{$smarty.const._AM_JILLDEID_RULE_LIST|escape}></caption>
        <thead>
            <tr>
                <th scope="col"><{$smarty.const._AM_JILLDEID_SORT|escape}></th>
                <th scope="col"><{$smarty.const._AM_JILLDEID_TITLE|escape}></th>
                <th scope="col"><{$smarty.const._AM_JILLDEID_CATEGORY|escape}></th>
                <th scope="col"><{$smarty.const._AM_JILLDEID_PATTERN|escape}></th>
                <th scope="col"><{$smarty.const._AM_JILLDEID_APPLY_TO_URL|escape}></th>
                <th scope="col"><{$smarty.const._AM_JILLDEID_RETENTION|escape}></th>
                <th scope="col"><{$smarty.const._AM_JILLDEID_STATUS|escape}></th>
                <th scope="col"><{$smarty.const._AM_JILLDEID_ACTIONS|escape}></th>
            </tr>
        </thead>
        <tbody>
            <{foreach from=$rules item=r}>
            <tr>
                <td><{$r.sort|escape}></td>
                <td>
                    <{$r.title|escape}>
                    <{if $r.locked == '1'}><span class="badge bg-secondary"><{$smarty.const._AM_JILLDEID_LOCKED|escape}></span><{/if}>
                    <{if $r.description}><div class="small text-muted"><{$r.description|escape}></div><{/if}>
                </td>
                <td><{$r.category|escape}></td>
                <td><code><{$r.pattern|escape}></code><{if $r.sample_text}><div class="small text-muted"><{$r.sample_text|escape}></div><{/if}></td>
                <td><{if $r.apply_to_url == '1'}><{$smarty.const._YES|escape}><{else}><{$smarty.const._NO|escape}><{/if}></td>
                <td><code><{$r.retention|escape}></code></td>
                <td>
                    <button type="button" class="btn btn-sm <{if $r.enable == '1'}>btn-success<{else}>btn-outline-secondary<{/if}> jill-deid-post" data-op="rule_toggle" data-id="<{$r.id|escape}>">
                        <{if $r.enable == '1'}><{$smarty.const._AM_JILLDEID_ENABLED|escape}><{else}><{$smarty.const._AM_JILLDEID_DISABLED|escape}><{/if}>
                    </button>
                </td>
                <td class="text-nowrap">
                    <a class="btn btn-sm btn-warning" href="main.php?op=rule_edit&amp;id=<{$r.id|escape}>"><i class="fa fa-pen" aria-hidden="true"></i> <{$smarty.const._AM_JILLDEID_EDIT|escape}></a>
                    <button type="button" class="btn btn-sm btn-danger jill-deid-post" data-op="rule_destroy" data-id="<{$r.id|escape}>"
                        data-confirm="<{$smarty.const._AM_JILLDEID_DELETE_CONFIRM|replace:'%s':$r.title|escape}>"><i class="fa fa-trash" aria-hidden="true"></i> <{$smarty.const._AM_JILLDEID_DELETE|escape}></button>
                </td>
            </tr>
            <{/foreach}>
        </tbody>
    </table>
</div>
<{else}>
<div class="alert alert-info"><{$smarty.const._AM_JILLDEID_RULE_EMPTY|escape}></div>
<{/if}>
<{include file="$xoops_rootpath/modules/jill_deid/templates/sub_jill_deid_post.tpl"}>
