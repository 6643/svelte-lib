<script>
    import RangeInput from "../../input/RangeInput.svelte";
</script>

<RangeInput label="Volume" value={4}>
    {#snippet left()}
        <span data-testid="left-addon">Min</span>
    {/snippet}

    {#snippet right()}
        <span data-testid="right-addon">Max</span>
    {/snippet}
</RangeInput>
