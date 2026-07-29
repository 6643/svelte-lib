<script lang="ts">
    import type { Snippet } from "svelte";

    type Props = {
        children: Snippet;
        /** 头部标题 */
        headerTitle?: string;
        /** 头部右侧操作区 */
        headerActions?: Snippet;
        /** 底部左侧文字 */
        footerLeft?: string;
        /** 底部右侧操作区 */
        footerRight?: Snippet;
    };

    let { children, headerTitle, headerActions, footerLeft, footerRight }: Props = $props();
</script>

<section class="block">
    <div class="header">
        {#if headerTitle}
            <span>{headerTitle}</span>
        {/if}
        <span>
            {#if headerActions}{@render headerActions()}{/if}
        </span>
    </div>
    <div>{@render children()}</div>
    {#if footerLeft || footerRight}
        <div class="footer">
            <span>{footerLeft}</span>
            <span>
                {#if footerRight}{@render footerRight()}{/if}
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
        color: var(--sunken-fg);
        padding: 8px 0;
    }

    .block > div {
        overflow: hidden;
        background-color: var(--disabled-color);
    }

    .block > div:first-child {
        border-top-left-radius: 9px;
        border-top-right-radius: 9px;
    }

    .block > div:last-child {
        border-bottom-left-radius: 9px;
        border-bottom-right-radius: 9px;
    }

    .header {
        width: 100%;
        min-height: 48px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 8px;
        gap: 8px;
    }

    .header > :last-child {
        flex: 1;
        display: flex;
        align-items: center;
        gap: 4px;
        justify-content: end;
    }
</style>
