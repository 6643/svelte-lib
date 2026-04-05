<script lang="ts">
    import { Block, FilledButton, icon_dark_mode, icon_house, icon_light_mode, icon_save } from "svelte-lib/ui";
    import { Route, routePush } from "svelte-lib/route";
    import { useTheme } from "svelte-lib/use";

    import Home from "./routes/Home.svelte";
    import NotFound from "./routes/NotFound.svelte";
    import Profile from "./routes/Profile.svelte";

    const { theme, toggleTheme } = useTheme();

    const openHome = () => routePush("/");
    const openProfile = () => routePush("/profile?name=Ada%20Lovelace");
    const openMissing = () => routePush("/missing");
</script>

<div class="app-shell">
    <section class="hero">
        <div class="hero-copy">
            <p class="eyebrow">svelte-lib demo</p>
            <h1>公开 UI、hooks、route 和 builder 的一体化样例。</h1>
            <p class="summary">
                这个 app 只通过 `svelte-lib/ui`、`svelte-lib/use`、`svelte-lib/route` 与 `svelte-lib/builder`
                使用仓库能力，不依赖内部深层路径。
            </p>
        </div>

        <div class="hero-actions">
            <FilledButton
                icon={$theme === "dark" ? icon_light_mode : icon_dark_mode}
                text={$theme === "dark" ? "Light" : "Dark"}
                tap={toggleTheme}
            />
        </div>
    </section>

    <Block headerTitle="Sample Navigation" footerLeft="Top-level demo only">
        {#snippet headerActions()}
            <FilledButton icon={icon_house} text="Home" tap={openHome} />
            <FilledButton icon={icon_save} text="Profile" tap={openProfile} />
            <FilledButton text="404" tap={openMissing} />
        {/snippet}

        {#snippet children()}
            <div class="route-stage">
                <Route path="/" component={Home} />
                <Route path="/profile" component={Profile} $name={String} />
                <Route path="*" component={NotFound} />
            </div>
        {/snippet}

        {#snippet footerRight()}
            <span class="footer-note">
                Current theme: {$theme}. Public imports only.
            </span>
        {/snippet}
    </Block>
</div>

<style>
    :global(:root) {
        color-scheme: light;
        --theme-color: #0f8b6d;
        --sf-color: #17342f;
        --sb-color: rgba(255, 255, 255, 0.82);
        background:
            radial-gradient(circle at top, rgba(15, 139, 109, 0.18), transparent 36%),
            linear-gradient(180deg, #f5fffb 0%, #edf7f3 100%);
        font-family: "IBM Plex Sans", "Segoe UI", sans-serif;
    }

    :global(:root[theme="dark"]) {
        color-scheme: dark;
        --theme-color: #75e0c3;
        --sf-color: #effff9;
        --sb-color: rgba(13, 42, 35, 0.84);
        background:
            radial-gradient(circle at top, rgba(117, 224, 195, 0.18), transparent 32%),
            linear-gradient(180deg, #081714 0%, #0d211c 100%);
    }

    :global(body) {
        margin: 0;
        min-height: 100vh;
        background: inherit;
    }

    .app-shell {
        max-width: 1040px;
        margin: 0 auto;
        padding: 24px;
        display: flex;
        flex-direction: column;
        gap: 20px;
    }

    .hero {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 16px;
        align-items: start;
        color: var(--sf-color);
    }

    .hero-copy {
        display: flex;
        flex-direction: column;
        gap: 12px;
    }

    .eyebrow {
        margin: 0;
        font-size: 0.85rem;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        opacity: 0.72;
    }

    h1 {
        margin: 0;
        font-size: clamp(2rem, 5vw, 4rem);
        line-height: 0.96;
        max-width: 12ch;
    }

    .summary {
        margin: 0;
        max-width: 56ch;
        line-height: 1.5;
    }

    .hero-actions {
        display: flex;
        justify-content: end;
    }

    .route-stage {
        min-height: 360px;
    }

    .footer-note {
        font-size: 0.875rem;
        opacity: 0.8;
    }

    @media (max-width: 720px) {
        .app-shell {
            padding: 16px;
        }

        .hero {
            grid-template-columns: 1fr;
        }

        .hero-actions {
            justify-content: start;
        }
    }
</style>
