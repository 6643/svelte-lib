<script lang="ts">
    type Props = {
        children?: import("svelte").Snippet;
        /** 宽度百分比，默认 100 */
        w?: number;
        /** 高度百分比，默认 100 */
        h?: number;
    };

    let { children, w, h }: Props = $props();
</script>

<div class="center-box" style:--w={w} style:--h={h}>
    {#if children}{@render children()}{/if}
</div>

<style>
    .center-box {
        display: grid;
        place-items: center;
        width: calc(var(--w, 100) * 1%);
        height: calc(var(--h, 100) * 1%);
    }
</style>
