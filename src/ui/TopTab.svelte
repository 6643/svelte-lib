<script lang="ts">
    import type { Snippet } from "svelte";
    import SvgIcon from "./SvgIcon.svelte";

    type TabItem = { name?: string; icon?: string; panel: Snippet };
    type Props = { items: TabItem[] };

    let { items }: Props = $props();

    let activeIndex = $state(0);
    let scrollPos = $state<Record<string, number>>({});
    let mainEl = $state<HTMLDivElement>();

    const toIndex = (i: number) => { if (i === activeIndex) return; activeIndex = i; };
    const handleScroll = (i: number) => (e: Event) => { scrollPos[`top.tab.${i}`] = (e.target as HTMLElement).scrollTop; };
</script>

<div class="topTab">
    <nav style="--count: {items.length}; --index: {activeIndex}">
        {#each items as item, i}
            <div role="tab" tabindex="0" class:active={i === activeIndex} onclick={() => toIndex(i)} onkeydown={(e) => e.key === "Enter" && toIndex(i)}>
                {#if item.icon}<SvgIcon svgPaths={item.icon} size={24} />{/if}
                {#if item.name}<span>{item.name}</span>{/if}
            </div>
        {/each}
    </nav>

    {#each items as item, i}
        {#if i === activeIndex}
            <div role="region" class:moveRight={i < activeIndex} class:moveLeft={i >= activeIndex} onscroll={handleScroll(i)} bind:this={mainEl}>
                {@render item.panel()}
            </div>
        {/if}
    {/each}
</div>

<style>
    .topTab { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
    .topTab > [role="region"] { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; }
    .moveRight { animation: slideRight 240ms ease; }
    .moveLeft { animation: slideLeft 240ms ease; }
    @keyframes slideRight { from { opacity: 0; transform: translateX(-30px); } to { opacity: 1; transform: translateX(0); } }
    @keyframes slideLeft { from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: translateX(0); } }
    .topTab > nav { display: flex; align-items: center; gap: 4px; height: 48px; padding: 0 12px; background: var(--raised-bg); border-bottom: 1px solid var(--sunken-bg); }
    .topTab > nav > div { display: flex; align-items: center; gap: 4px; padding: 0 12px; height: 36px; border-radius: 36px; cursor: pointer; color: var(--sunken-fg); font-size: 14px; transition: background 160ms ease, color 160ms ease; white-space: nowrap; }
    .topTab > nav > div.active { background: var(--accent-color); color: white; }
</style>
