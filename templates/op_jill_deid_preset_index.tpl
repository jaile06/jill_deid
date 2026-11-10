<{if $all_jill_deid_preset|default:false}>
    <{if $smarty.session.jill_deid_adm|default:false}>
        <script type="text/javascript">
            $(document).ready(function(){
                $("#jill_deid_preset_sort").sortable({ opacity: 0.6, cursor: "move", update: function() {
                    var order = $(this).sortable("serialize");
                    $.post("<{$xoops_url}>/modules/jill_deid/admin/jill_deid_preset_save_sort.php", order + "&op=update_jill_deid_preset_sort", function(msg){
                        $("#jill_deid_preset_save_msg").html(msg);
                    });
                }
                });
            });
        </script>
    <{/if}>

    <div id="jill_deid_preset_save_msg"></div>

    <table data-toggle="table" data-pagination="true" data-search="true" data-mobile-responsive="true" class="table table-sm table-striped table-hover">
        <caption class="visually-hidden" style="caption-side: top;"><{$xoops_pagetitle|default:'jill_deid_preset'}></caption>
        <thead>
            <tr>
            <!--方案名稱-->
            <th scope="col" data-field="title" data-sortable="true" class="nowrap c"><{$smarty.const._MD_JILLDEID_PRESET_TITLE}></th>
            <!--說明-->
            <th scope="col" data-field="description" data-sortable="true" class="nowrap c"><{$smarty.const._MD_JILLDEID_PRESET_DESCRIPTION}></th>
            <!--保留策略-->
            <th scope="col" data-field="keep_strategy" data-sortable="true" class="nowrap c"><{$smarty.const._MD_JILLDEID_PRESET_KEEP_STRATEGY}></th>
            <!--遮罩標記樣式-->
            <th scope="col" data-field="marker_style" data-sortable="true" class="nowrap c"><{$smarty.const._MD_JILLDEID_PRESET_MARKER_STYLE}></th>
            <!--超連結處理方式-->
            <th scope="col" data-field="hyperlink_mode" data-sortable="true" class="nowrap c"><{$smarty.const._MD_JILLDEID_PRESET_HYPERLINK_MODE}></th>
            <!--自訂設定-->
            <th scope="col" data-field="custom_config" data-sortable="true" class="nowrap c"><{$smarty.const._MD_JILLDEID_PRESET_CUSTOM_CONFIG}></th>
            <!--是否為預設-->
            <th scope="col" data-field="is_default" data-sortable="true" class="nowrap c"><{$smarty.const._MD_JILLDEID_PRESET_IS_DEFAULT}></th>
            <!--是否啟用-->
            <th scope="col" data-field="enable" data-sortable="true" class="nowrap c"><{$smarty.const._MD_JILLDEID_PRESET_ENABLE}></th>
                <{if $smarty.session.jill_deid_adm|default:false}>
                    <th scope="col"><{$smarty.const._TAD_FUNCTION}></th>
                <{/if}>
            </tr>
        </thead>
        <{foreach from=$all_jill_deid_preset key=k item=data name=all_jill_deid_preset}>
            <tr>
            <!--方案名稱-->
            <td><a href="<{$xoops_url}>/modules/jill_deid/index.php?id=<{$data.id}>"><{$data.title}></a></td>

            <!--說明-->
            <td><{$data.description}></td>

            <!--保留策略-->
            <td><{$data.keep_strategy}></td>

            <!--遮罩標記樣式-->
            <td><{$data.marker_style}></td>

            <!--超連結處理方式-->
            <td><{$data.hyperlink_mode}></td>

            <!--自訂設定-->
            <td><{$data.custom_config}></td>

            <!--是否為預設-->
            <td><{if $data.is_default == '1'}>
                        <img src="<{$xoops_url}>/modules/jill_deid/images/yes.gif" alt="<{$smarty.const._TAD_ENABLE}>" title="<{$smarty.const._TAD_ENABLE}>">
                    <{else}>
                        <img src="<{$xoops_url}>/modules/jill_deid/images/no.gif" alt="<{$smarty.const._TAD_UNABLE}>" title="<{$smarty.const._TAD_UNABLE}>">
                    <{/if}>
</td>

            <!--是否啟用-->
            <td><{if $data.enable == '1'}>
                        <img src="<{$xoops_url}>/modules/jill_deid/images/yes.gif" alt="<{$smarty.const._TAD_ENABLE}>" title="<{$smarty.const._TAD_ENABLE}>">
                    <{else}>
                        <img src="<{$xoops_url}>/modules/jill_deid/images/no.gif" alt="<{$smarty.const._TAD_UNABLE}>" title="<{$smarty.const._TAD_UNABLE}>">
                    <{/if}>
</td>

                <{if $smarty.session.jill_deid_adm|default:false}>
                    <td>
                        <a href="javascript:jill_deid_preset_destroy_func(<{$data.id}>);" class="btn btn-sm btn-danger" aria-label="<{$smarty.const._TAD_DEL}>" title="<{$smarty.const._TAD_DEL}>"><i class="fa fa-trash" aria-hidden="true"></i></a>
                        <a href="<{$xoops_url}>/modules/jill_deid/index.php?op=jill_deid_preset_edit&id=<{$data.id}>" class="btn btn-sm btn-warning" aria-label="<{$smarty.const._TAD_EDIT}>" title="<{$smarty.const._TAD_EDIT}>"><i class="fa fa-pencil" aria-hidden="true"></i></a>
                        <i class="fa fa-sort" aria-hidden="true" title="<{$smarty.const._TAD_SORTABLE}>"></i><span class="visually-hidden sr-only"><{$smarty.const._TAD_SORTABLE}></span>
                    </td>
                <{/if}>
            </tr>
        <{/foreach}>
    </table>

    <{if $smarty.session.jill_deid_adm|default:false}>
        <div class="text-end my-3">
            <a href="<{$xoops_url}>/modules/jill_deid/index.php?op=jill_deid_preset_create" class="btn btn-info">
                <i class="fa fa-plus" aria-hidden="true"></i> <{$smarty.const._TAD_ADD}>
            </a>
        </div>
    <{/if}>

    <div class="bar"><{$bar|default:''}></div>
<{else}>
    <div class="alert alert-warning text-center">
        <{if $smarty.session.jill_deid_adm|default:false}>
            <a href="<{$xoops_url}>/modules/jill_deid/index.php?op=jill_deid_preset_create" class="btn btn-info">
                <i class="fa fa-plus" aria-hidden="true"></i> <{$smarty.const._TAD_ADD}>
            </a>
        <{else}>
            <h3><{$smarty.const._TAD_EMPTY}></h3>
        <{/if}>
    </div>
<{/if}>
