<script lang="ts">
    import type { Snippet } from "svelte";
    import Button from "./Button.svelte";
    import { icon_menu } from "./svgicons";

    type TabItem = { name: string; panel: Snippet };
    type Props = { items: TabItem[] };

    let { items }: Props = $props();

    let activeIndex = $state(0);
    let indicator = $state({ left: 0, width: 0 });
    let listEl: HTMLDivElement | undefined;
    let scrollPos = $state<Record<string, number>>({});

    const initIndicator = (index: number) => {
        if (!listEl) return;
        const child = listEl.children[index] as HTMLElement | undefined;
        if (child) indicator = { left: child.offsetLeft, width: child.offsetWidth };
    };

    const toIndex = (i: number) => {
        if (!listEl || i === activeIndex) return;
        const child = listEl.children[i] as HTMLElement | undefined;
        if (!child) return;
        indicator = { left: child.offsetLeft, width: child.offsetWidth };
        activeIndex = i;
    };

    $effect(() => { if (listEl) initIndicator(activeIndex); });
</script>

<div class="menuTab" style="--left: {indicator.left}px; --width: {indicator.width}px">
    <nav>
        <div class="navList" bind:this={listEl}>
            {#each items as item, i}
                <div role="tab" tabindex="0" class:active={i === activeIndex}
                    onclick={() => toIndex(i)}
                    onkeydown={(e) => e.key === "Enter" && toIndex(i)}>
                    {item.name}
                </div>
            {/each}
        </div>
        <Button mode="icon" svgPaths={icon_menu} />
    </nav>

    <div role="region" onscroll={(e) => { scrollPos["menu.tab"] = (e.target as HTMLElement).scrollTop; }}>
        {#if items[activeIndex]}{@render items[activeIndex].panel()}{/if}
    </div>
</div>

<style>
    .menuTab { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
    .menuTab > nav { display: flex; align-items: center; position: relative; background: var(--raised-bg); border-bottom: 2px solid var(--sunken-bg); }
    .navList { display: flex; gap: 0; overflow-x: auto; flex: 1; scrollbar-width: none; position: relative; }
    .navList::-webkit-scrollbar { display: none; }
    .navList::after { content: ""; position: absolute; bottom: 0; left: var(--left, 0); width: var(--width, 0); height: 2px; background: var(--accent-color); transition: left 240ms ease, width 240ms ease; }
    .navList > div { padding: 0 16px; height: 44px; line-height: 44px; cursor: pointer; white-space: nowrap; font-size: 14px; color: var(--sunken-fg); transition: color 160ms ease; }
    .navList > div.active { color: var(--accent-color); }
    .menuTab > [role="region"] { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; padding: 12px; }
</style>
