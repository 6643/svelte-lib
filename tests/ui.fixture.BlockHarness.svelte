<script>
    import Block from "../ui/Block.svelte";
</script>

<Block headerTitle="Title" footerLeft="Left">
    {#snippet headerActions()}
        <span data-testid="header-actions">Actions</span>
    {/snippet}

    {#snippet children()}
        <div data-testid="body">Body</div>
    {/snippet}

    {#snippet footerRight()}
        <span data-testid="footer-right">More</span>
    {/snippet}
</Block>
