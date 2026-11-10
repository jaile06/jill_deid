<h3 class="my text-center">
    <a href="<{$smarty.server.SCRIPT_NAME}>" class="link-dark" data-bs-toggle="tooltip" aria-label="<{$smarty.const._TAD_BACK_PAGE}>" title="<{$smarty.const._TAD_BACK_PAGE}>">
        <i class="fa-solid fa-turn-up fa-rotate-270" aria-hidden="true"></i>
    </a>
    <{$title}>
</h3>

<div class="text-center">
    <{if $smarty.session.jill_deid_adm|default:false}>
        <a href="javascript:jill_deid_preset_destroy_func(<{$id}>);" class="btn btn-sm btn-danger" data-bs-toggle="tooltip" aria-label="<{$smarty.const._TAD_DEL}>" title="<{$smarty.const._TAD_DEL}>"><i class="fa fa-times" aria-hidden="true"></i></a>
        <a href="<{$xoops_url}>/modules/jill_deid/index.php?op=jill_deid_preset_edit&id=<{$id}>" class="btn btn-sm btn-warning"><i class="fa fa-pencil" aria-hidden="true"></i> <{$smarty.const._TAD_EDIT}></a>
        <a href="<{$xoops_url}>/modules/jill_deid/index.php?op=jill_deid_preset_create" class="btn btn-sm btn-primary"><i class="fa fa-plus" aria-hidden="true"></i> <{$smarty.const._TAD_ADD}></a>
    <{/if}>
</div>

<{$custom_config}>

<table class="table table-striped mt-3">
    <caption class="visually-hidden" style="caption-side: top;"><{$xoops_pagetitle|default:'jill_deid_preset'}></caption>
    <tbody>
<!--說明-->
<tr>
    <th scope="row" class="w-25"><{$smarty.const._MD_JILLDEID_PRESET_DESCRIPTION}></th>
    <td><{$description}></td>
</tr>

<!--保留策略-->
<tr>
    <th scope="row" class="w-25"><{$smarty.const._MD_JILLDEID_PRESET_KEEP_STRATEGY}></th>
    <td><{$keep_strategy}></td>
</tr>

<!--遮罩標記樣式-->
<tr>
    <th scope="row" class="w-25"><{$smarty.const._MD_JILLDEID_PRESET_MARKER_STYLE}></th>
    <td><{$marker_style}></td>
</tr>

<!--超連結處理方式-->
<tr>
    <th scope="row" class="w-25"><{$smarty.const._MD_JILLDEID_PRESET_HYPERLINK_MODE}></th>
    <td><{$hyperlink_mode}></td>
</tr>

    </tbody>
</table>
