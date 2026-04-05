<script lang="ts">
    import { Block, FilledButton, icon_save } from "svelte-lib/ui";
    import { routePush } from "svelte-lib/route";

    const openProfile = () => routePush("/profile?name=Ada%20Lovelace");
</script>

<Block headerTitle="Home" footerLeft="Route component demo">
    {#snippet headerActions()}
        <FilledButton icon={icon_save} text="Open Profile" tap={openProfile} />
    {/snippet}

    {#snippet children()}
        <div class="stack">
            <p>
                这是一个完整样例 app，而不是库运行时代码的一部分。它通过公开入口消费
                `svelte-lib`。
            </p>

            <ul>
                <li>`svelte-lib/ui` 提供可复用组件。</li>
                <li>`svelte-lib/use` 提供主题状态工具。</li>
                <li>`svelte-lib/route` 提供声明式路由与导航辅助函数。</li>
                <li>`svelte-lib/builder` 负责本 demo 的 dev/build 入口。</li>
            </ul>
        </div>
    {/snippet}

    {#snippet footerRight()}
        <span class="hint">继续进入 Profile 页面可以看到 query decoder 与 modal。</span>
    {/snippet}
</Block>

<style>
    .stack {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 8px 0;
    }

    p,
    ul {
        margin: 0;
    }

    ul {
        padding-left: 18px;
        line-height: 1.5;
    }

    .hint {
        font-size: 0.875rem;
        opacity: 0.8;
    }
</style>
