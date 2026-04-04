<script>
    import StringInput from "../ui/Input.string.svelte";
</script>

<StringInput label="Name" value="Ada">
    {#snippet left()}
        <span data-testid="left-addon">L</span>
    {/snippet}

    {#snippet right()}
        <span data-testid="right-addon">R</span>
    {/snippet}
</StringInput>
