<script lang="ts">
    import type { Snippet } from "svelte";

    type TabItem = { name: string; panel: Snippet };
    type Props = { items: TabItem[] };

    let { items }: Props = $props();

    const ITEM_H = 68;
    let activeIndex = $state(0);
    let isToUp = $state(false);
    let top = $state(0);
    let scrollPos = $state<Record<string, number>>({});

    const toIndex = (i: number) => {
        if (i === activeIndex) return;
        top = ITEM_H * i;
        isToUp = i > activeIndex;
        activeIndex = i;
    };
</script>

<div class="leftTab">
    <nav style="--top: {top}px">
        {#each items as item, i}
            <div role="tab" tabindex="0" class:active={i === activeIndex}
                onclick={() => toIndex(i)}
                onkeydown={(e) => e.key === "Enter" && toIndex(i)}>
                {item.name}
            </div>
        {/each}
    </nav>

    {#each items as item, i}
        {#if i === activeIndex}
            <div role="region" class:moveUp={isToUp} class:moveDown={!isToUp}
                onscroll={(e) => { scrollPos[`left.tab.${i}`] = (e.target as HTMLElement).scrollTop; }}>
                {@render item.panel()}
            </div>
        {/if}
    {/each}
</div>

<style>
    .leftTab { display: flex; height: 100vh; overflow: hidden; }
    .leftTab > nav { width: 80px; overflow-y: auto; background: var(--sunken-bg); padding: 8px 0; flex-shrink: 0; }
    .leftTab > nav > div { height: 60px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--sunken-fg); font-size: 13px; text-align: center; padding: 4px; transition: color 160ms ease, background 160ms ease; }
    .leftTab > nav > div.active { color: var(--accent-color); background: color-mix(in srgb, var(--accent-color) 10%, transparent); }
    .leftTab > [role="region"] { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; }
    .moveUp { animation: slideUp 240ms ease; }
    .moveDown { animation: slideDown 240ms ease; }
    @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes slideDown { from { opacity: 0; transform: translateY(-20px); } to { opacity: 1; transform: translateY(0); } }
</style>
