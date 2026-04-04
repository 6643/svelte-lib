<script>
    import FilledModal from "../ui/Modal.filled.svelte";
</script>

<FilledModal active={true}>
    {#snippet children()}
        <div data-testid="modal-body">Modal Body</div>
    {/snippet}
</FilledModal>
