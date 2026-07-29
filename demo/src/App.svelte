<script lang="ts">
    import ButtonsPage from "./pages/ButtonsPage.svelte";
    import InputsPage from "./pages/InputsPage.svelte";
    import LayoutPage from "./pages/LayoutPage.svelte";
    import DisplayPage from "./pages/DisplayPage.svelte";
    import InteractivePage from "./pages/InteractivePage.svelte";
    import TabsPage from "./pages/TabsPage.svelte";
    import ThemePage from "./pages/ThemePage.svelte";

    let activePage = $state(0);

    const pages = ["按钮", "输入", "布局", "展示", "交互", "Tabs", "主题"];
</script>

<div class="shell">
    <nav>
        {#each pages as label, i}
            <button type="button" class:active={i === activePage} onclick={() => activePage = i}>
                {label}
            </button>
        {/each}
    </nav>

    <main>
        {#if activePage === 0}
            <ButtonsPage />
        {:else if activePage === 1}
            <InputsPage />
        {:else if activePage === 2}
            <LayoutPage />
        {:else if activePage === 3}
            <DisplayPage />
        {:else if activePage === 4}
            <InteractivePage />
        {:else if activePage === 5}
            <TabsPage />
        {:else if activePage === 6}
            <ThemePage />
        {/if}
    </main>
</div>

<style>
    :global(body) { margin: 0; font-family: system-ui, sans-serif; background: var(--base-bg, #fafafa); color: var(--raised-fg, #1a1a1a); }
    .shell { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
    nav { display: flex; justify-content: space-around; align-items: center; height: 48px; background: var(--raised-bg, white); border-bottom: 1px solid var(--sunken-bg, #ddd); flex-shrink: 0; overflow-x: auto; gap: 0; }
    nav button { background: none; border: none; padding: 0 12px; height: 48px; cursor: pointer; color: var(--sunken-fg, #999); font-size: 13px; transition: color 160ms ease, border-bottom 160ms ease; border-bottom: 2px solid transparent; font-family: inherit; white-space: nowrap; }
    nav button.active { color: var(--accent-color, #e95420); border-bottom-color: var(--accent-color, #e95420); }
    main { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; }
</style>
