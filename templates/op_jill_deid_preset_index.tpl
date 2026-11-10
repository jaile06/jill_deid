<h4><{$smarty.const._AM_JILLDEID_PRESET_LIST|escape}></h4>
<p class="text-muted"><{$smarty.const._AM_JILLDEID_PRESET_INTRO|escape}></p>
<div class="mb-3">
    <a class="btn btn-primary" href="main.php?op=preset_create"><i class="fa fa-plus" aria-hidden="true"></i> <{$smarty.const._AM_JILLDEID_PRESET_ADD|escape}></a>
</div>
<{if $presets}>
<div class="table-responsive">
    <table class="table table-striped table-hover align-middle">
        <caption class="visually-hidden"><{$smarty.const._AM_JILLDEID_PRESET_LIST|escape}></caption>
        <thead>
            <tr>
                <th scope="col"><{$smarty.const._AM_JILLDEID_SORT|escape}></th>
                <th scope="col"><{$smarty.const._AM_JILLDEID_TITLE|escape}></th>
                <th scope="col"><{$smarty.const._AM_JILLDEID_KEEP_STRATEGY|escape}></th>
                <th scope="col"><{$smarty.const._AM_JILLDEID_MARKER_STYLE|escape}></th>
                <th scope="col"><{$smarty.const._AM_JILLDEID_HYPERLINK_MODE|escape}></th>
                <th scope="col"><{$smarty.const._AM_JILLDEID_STATUS|escape}></th>
                <th scope="col"><{$smarty.const._AM_JILLDEID_ACTIONS|escape}></th>
            </tr>
        </thead>
        <tbody>
            <{foreach from=$presets item=p}>
            <tr>
                <td><{$p.sort|escape}></td>
                <td>
                    <{$p.title|escape}>
                    <{if $p.is_default == '1'}><span class="badge bg-primary"><{$smarty.const._AM_JILLDEID_IS_DEFAULT|escape}></span><{/if}>
                    <{if $p.description}><div class="small text-muted"><{$p.description|escape}></div><{/if}>
                </td>
                <td><code><{$p.keep_strategy|escape}></code></td>
                <td><code><{$p.marker_style|escape}></code></td>
                <td><code><{$p.hyperlink_mode|escape}></code></td>
                <td>
                    <button type="button" class="btn btn-sm <{if $p.enable == '1'}>btn-success<{else}>btn-outline-secondary<{/if}> jill-deid-post" data-op="preset_toggle" data-id="<{$p.id|escape}>">
                        <{if $p.enable == '1'}><{$smarty.const._AM_JILLDEID_ENABLED|escape}><{else}><{$smarty.const._AM_JILLDEID_DISABLED|escape}><{/if}>
                    </button>
                </td>
                <td class="text-nowrap">
                    <a class="btn btn-sm btn-warning" href="main.php?op=preset_edit&amp;id=<{$p.id|escape}>"><i class="fa fa-pen" aria-hidden="true"></i> <{$smarty.const._AM_JILLDEID_EDIT|escape}></a>
                    <button type="button" class="btn btn-sm btn-danger jill-deid-post" data-op="preset_destroy" data-id="<{$p.id|escape}>"
                        data-confirm="<{$smarty.const._AM_JILLDEID_DELETE_CONFIRM|replace:'%s':$p.title|escape}>"><i class="fa fa-trash" aria-hidden="true"></i> <{$smarty.const._AM_JILLDEID_DELETE|escape}></button>
                </td>
            </tr>
            <{/foreach}>
        </tbody>
    </table>
</div>
<{else}>
<div class="alert alert-info"><{$smarty.const._AM_JILLDEID_PRESET_EMPTY|escape}></div>
<{/if}>
<{include file="$xoops_rootpath/modules/jill_deid/templates/sub_jill_deid_post.tpl"}>
