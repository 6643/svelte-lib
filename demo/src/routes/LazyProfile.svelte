<script lang="ts">
    import { Block, FilledButton, icon_house, icon_save } from "svelte-lib/ui";
    import { routePush } from "svelte-lib/route";

    type Props = {
        name?: string;
    };

    let { name = "Grace Hopper" }: Props = $props();

    const goHome = () => routePush("/");
    const openEagerProfile = () =>
        routePush(`/profile?name=${encodeURIComponent(name ?? "Grace Hopper")}`);
</script>

<Block headerTitle="Lazy Profile" footerLeft="Loaded via route-level import()">
    {#snippet headerActions()}
        <FilledButton icon={icon_house} text="Back Home" tap={goHome} />
        <FilledButton icon={icon_save} text="Open Eager Profile" tap={openEagerProfile} />
    {/snippet}

    {#snippet children()}
        <div class="stack">
            <p>
                这个页面通过
                <code>component=&#123;() =&gt; import("./routes/LazyProfile.svelte")&#125;</code>
                按需加载，只有访问 `/lazy` 时才会请求对应 chunk。
            </p>

            <div class="meta">
                <span>Decoded prop:</span>
                <strong>{name}</strong>
            </div>
        </div>
    {/snippet}

    {#snippet footerRight()}
        <span class="hint">适合体积更大、低频访问的页面。</span>
    {/snippet}
</Block>

<style>
    .stack {
        display: flex;
        flex-direction: column;
        gap: 14px;
        padding: 8px 0;
    }

    .stack p {
        margin: 0;
        line-height: 1.55;
    }

    .stack code {
        font-family:
            "IBM Plex Mono",
            monospace;
    }

    .meta {
        display: flex;
        gap: 8px;
        align-items: center;
        flex-wrap: wrap;
    }

    .hint {
        font-size: 0.875rem;
        opacity: 0.8;
    }
</style>
