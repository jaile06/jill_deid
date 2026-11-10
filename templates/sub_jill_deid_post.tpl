<{* 刪除、切換、匯入共用的 POST 表單（spec §6.2：不用 SweetAlert::render()，它只能 GET） *}>
<form method="post" action="main.php" id="jill-deid-post-form" class="d-none"
      data-yes="<{$smarty.const._AM_JILLDEID_CONFIRM_YES|escape}>" data-no="<{$smarty.const._AM_JILLDEID_CONFIRM_NO|escape}>">
    <input type="hidden" name="op" value="">
    <input type="hidden" name="id" value="">
    <{$token_form|default:''}>
</form>
<script>
document.addEventListener('click', function (e) {
    var b = e.target.closest('.jill-deid-post');
    if (!b) return;
    var f = document.getElementById('jill-deid-post-form');
    f.elements.namedItem('op').value = b.dataset.op;
    f.elements.namedItem('id').value = b.dataset.id || '';
    if (!b.dataset.confirm) { f.submit(); return; }
    swal({ title: b.dataset.confirm, type: 'warning', showCancelButton: true, confirmButtonColor: '#d33',
        confirmButtonText: f.dataset.yes, cancelButtonText: f.dataset.no }, function () { f.submit(); });
});
</script>
