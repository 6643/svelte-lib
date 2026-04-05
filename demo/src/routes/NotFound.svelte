<script lang="ts">
    import { Block, FilledButton, icon_house } from "svelte-lib/ui";
    import { routePush } from "svelte-lib/route";

    const goHome = () => routePush("/");
</script>

<Block headerTitle="Not Found" footerLeft="Fallback route">
    {#snippet children()}
        <p class="copy">
            当前路径没有匹配的 demo route。这个页面来自 `path="*"` 的兜底路由。
        </p>
    {/snippet}

    {#snippet footerRight()}
        <FilledButton icon={icon_house} text="Back Home" tap={goHome} />
    {/snippet}
</Block>

<style>
    .copy {
        margin: 0;
        padding: 8px 0;
        line-height: 1.5;
    }
</style>
