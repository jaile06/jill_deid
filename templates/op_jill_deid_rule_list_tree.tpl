<div class="row">
    <div class="col-sm-3">
        <div id="save_msg"></div>
        <{$ztree_code|default:''}>
        <div class="d-grid gap-2">
            <a href="main.php?op=jill_deid_rule_create" class="btn btn-info btn-block"><{$smarty.const._TAD_ADD_CATE}></a>
        </div>
    </div>

    <div class="col-sm-9">
        <{if $id > 0}>
            <div class="row">
                <div class="col-sm-4">
                    <h3><{$cate.title}></h3>
                    <div class="my-1"><{$cate.description}></div>
                </div>
                <div class="col-sm-8 text-right text-end my-3">
                    <div style="margin-top: 10px;">
                        <a href="javascript:jill_deid_rule_destroy_func(<{$cate.id}>);" class="btn btn-danger <{if $cate_count.$id > 0}>disabled<{/if}>"><{$smarty.const._TAD_DEL}></a>
                        <a href="main.php?op=jill_deid_rule_edit&id=<{$id}>" class="btn btn-warning"><{$smarty.const._TAD_EDIT}></a>
                        <a href="main.php?op=jill_deid_preset_create&id=<{$id}>" class="btn btn-info"><{$smarty.const._TAD_ADD}></a>
                    </div>
                </div>
            </div>
        <{/if}>

        <{if $now_op=="jill_deid_rule_create"}>
            <{include file="$xoops_rootpath/modules/jill_deid/templates/op_jill_deid_rule_create.tpl"}>
        <{elseif $now_op=="jill_deid_preset_create"}>
            <{include file="$xoops_rootpath/modules/jill_deid/templates/op_jill_deid_preset_create.tpl"}>
        <{elseif $now_op=="jill_deid_rule_list_tree"}>
            <form action="main.php" method="post">
                <{include file="$xoops_rootpath/modules/jill_deid/templates/op_jill_deid_preset_index.tpl"}>
            </form>
        <{else}>
            <div class="alert alert-danger text-center">
                <h3><{$smarty.const._TAD_EMPTY}></h3>
            </div>
        <{/if}>
    </div>
</div>
