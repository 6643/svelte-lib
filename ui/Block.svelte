<script lang="ts">
    import type { Snippet } from "svelte";

    export let children: Snippet | undefined = undefined;
    export let footerLeft = "";
    export let footerRight: Snippet | undefined = undefined;
    export let headerActions: Snippet | undefined = undefined;
    export let headerTitle = "";
</script>

<section class="block">
    <div class="header">
        <span>{headerTitle}</span>
        <span>
            {#if headerActions}
                {@render headerActions()}
            {/if}
        </span>
    </div>

    <div class="body">
        {#if children}
            {@render children()}
        {/if}
    </div>

    {#if footerLeft}
        <div class="footer">
            <span>{footerLeft}</span>
            <span>
                {#if footerRight}
                    {@render footerRight()}
                {/if}
            </span>
        </div>
    {/if}
</section>

<style>
    .block {
        display: flex;
        flex-direction: column;
        gap: 4px;
        user-select: none;
        color: var(--sf-color);
        padding: 8px 0;
    }

    .header,
    .body,
    .footer {
        overflow: hidden;
        background-color: var(--sb-color);
    }

    .header {
        width: 100%;
        min-height: 48px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 8px;
        gap: 8px;
        border-top-left-radius: 9px;
        border-top-right-radius: 9px;
    }

    .header > :last-child {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 4px;
        justify-content: end;
    }

    .body:last-child,
    .footer:last-child {
        border-bottom-left-radius: 9px;
        border-bottom-right-radius: 9px;
    }

    .footer {
        min-height: 40px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 8px;
    }
</style>
