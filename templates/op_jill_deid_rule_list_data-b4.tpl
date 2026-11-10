<{if $all_jill_deid_preset|default:false}>
    <{if $smarty.session.jill_deid_adm|default:false}>
        
    <script type="text/javascript">
        $(document).ready(function(){
            $("#jill_deid_rule_sort").sortable({ opacity: 0.6, cursor: "move", update: function() {
                var order = $(this).sortable("serialize");
                $.post("<{$xoops_url}>/modules/jill_deid/admin/main.php", order + "&op=update_jill_deid_rule_sort", function(theResponse){
                    $("#jill_deid_rule_save_msg").html(theResponse);
                });
            }
            });
        });
    </script>
    <{/if}>

    <div id="jill_deid_preset_save_msg"></div>

    <table class="table table-striped table-hover">
        <caption class="visually-hidden sr-only" style="caption-side: top;"><{$xoops_pagetitle|default:'jill_deid_preset'}></caption>
        <thead>
            <tr class="info">
                
            <th scope="col">
                <!--規則名稱-->
                <{$smarty.const._MA_JILLDEID_RULE_TITLE}>
            </th>
            <th scope="col">
                <!--類別-->
                <{$smarty.const._MA_JILLDEID_RULE_CATEGORY}>
            </th>
            <th scope="col">
                <!--比對規則-->
                <{$smarty.const._MA_JILLDEID_RULE_PATTERN}>
            </th>
            <th scope="col">
                <!--套用於網址-->
                <{$smarty.const._MA_JILLDEID_RULE_APPLY_TO_URL}>
            </th>
            <th scope="col">
                <!--保留設定-->
                <{$smarty.const._MA_JILLDEID_RULE_RETENTION}>
            </th>
            <th scope="col">
                <!--範例文字-->
                <{$smarty.const._MA_JILLDEID_RULE_SAMPLE_TEXT}>
            </th>
            <th scope="col">
                <!--說明-->
                <{$smarty.const._MA_JILLDEID_RULE_DESCRIPTION}>
            </th>
            <th scope="col">
                <!--是否鎖定-->
                <{$smarty.const._MA_JILLDEID_RULE_LOCKED}>
            </th>
            <th scope="col">
                <!--是否啟用-->
                <{$smarty.const._MA_JILLDEID_RULE_ENABLE}>
            </th>
            <th scope="col">
                <!--修改者-->
                <{$smarty.const._MA_JILLDEID_RULE_UID}>
            </th>
            <th scope="col">
                <!--更新時間-->
                <{$smarty.const._MA_JILLDEID_RULE_UPDATED_AT}>
            </th>
                <{if $smarty.session.jill_deid_adm|default:false}>
                    <th scope="col"><{$smarty.const._TAD_FUNCTION}></th>
                <{/if}>
            </tr>
        </thead>

        <tbody id="jill_deid_preset_sort">
            <{foreach from=$all_jill_deid_preset item=data}>
                <tr id="tr_<{$data.id}>">
                    
            <td>
                <!--規則名稱-->
                <a href="<{$xoops_url}>/modules/jill_deid/admin/main.php?{auto_sn_edit_parm_tpl}"><{$data.title}></a>
            </td>

            <td>
                <!--類別-->
                <{$data.category}>
            </td>

            <td>
                <!--比對規則-->
                <{$data.pattern}>
            </td>

            <td>
                <!--套用於網址-->
                <{$data.apply_to_url}>
            </td>

            <td>
                <!--保留設定-->
                <{$data.retention}>
            </td>

            <td>
                <!--範例文字-->
                <{$data.sample_text}>
            </td>

            <td>
                <!--說明-->
                <{$data.description}>
            </td>

            <td>
                <!--是否鎖定-->
                <{$data.locked}>
            </td>

            <td>
                <!--是否啟用-->
                <{$data.enable}>
            </td>

            <td>
                <!--修改者-->
                <{$data.uid}>
            </td>

            <td>
                <!--更新時間-->
                <{$data.updated_at}>
            </td>

                    <{if $smarty.session.jill_deid_adm|default:false}>
                        <td>
                            <a href="javascript:jill_deid_preset_destroy_func(<{$data.id}>);" class="btn btn-sm btn-danger"><{$smarty.const._TAD_DEL}></a>
                            <a href="<{$xoops_url}>/modules/jill_deid/admin/main.php?op=jill_deid_preset_edit&id=<{$data.id}>" class="btn btn-sm btn-warning"><{$smarty.const._TAD_EDIT}></a>
                            {sort_pic}
                        </td>
                    <{/if}>
                </tr>
            <{/foreach}>
        </tbody>
    </table>


    <{if $smarty.session.jill_deid_adm|default:false}>
        <div class="text-right text-end my-3">
            <a href="<{$xoops_url}>/modules/jill_deid/admin/main.php?op=jill_deid_preset_create{cate_col_var}" class="btn btn-info"><{$smarty.const._TAD_ADD}></a>
        </div>
    <{/if}>

    <div class="bar"><{$bar|default:''}></div>
<{else}>
    <div class="alert alert-warning text-center">
        <{if $smarty.session.jill_deid_adm|default:false}>
            <a href="<{$xoops_url}>/modules/jill_deid/admin/main.php?op=jill_deid_preset_create{cate_col_var}" class="btn btn-info"><{$smarty.const._TAD_ADD}></a>
        <{else}>
            <h3><{$smarty.const._TAD_EMPTY}></h3>
        <{/if}>
    </div>
<{/if}>
