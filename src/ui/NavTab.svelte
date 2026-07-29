<script lang="ts">
    import type { Snippet } from "svelte";
    import { useDebounce } from "../util/useDebounce.ts";

    type TabItem = { name: string; panel: Snippet };
    type Props = { items: TabItem[] };

    let { items }: Props = $props();

    const ITEM_H = 48;
    const GAP = 4;
    const STEP = ITEM_H + GAP;

    let actives = $state<boolean[]>(items.map(() => false));
    let top = $state(0);
    let height = $state(0);
    let navEl: HTMLElement | undefined;
    let mainEl: HTMLDivElement | undefined;
    let clickIndex = -1;
    let navCount = $derived(items.length);

    const getChildsVis = (boxEl: HTMLElement) => {
        const box = boxEl.getBoundingClientRect();
        return Array.from(boxEl.children).map(child => {
            const cr = child.getBoundingClientRect();
            if (cr.height === 0) return { ratio: 0, offset: 0 };
            const visibleTop = Math.max(cr.y - box.y, 0);
            const visibleBottom = Math.min(cr.bottom - box.y, box.height);
            const visibleHeight = Math.max(0, visibleBottom - visibleTop);
            const offset = Math.max(0, box.y - cr.y) / cr.height;
            return { ratio: visibleHeight / cr.height, offset };
        });
    };

    const computed = (content: HTMLElement) => {
        const childsVis = getChildsVis(content);
        const ratios = childsVis.reduce((s, c) => s + c.ratio, 0);
        if (ratios === 0) return;
        const firstIndex = childsVis.findIndex(c => c.ratio > 0);
        const first = childsVis[firstIndex] ?? { ratio: 0, offset: 0 };
        const h = ratios * ITEM_H + (Math.ceil(ratios) - 1) * GAP;
        const lastBottom = navCount * STEP;
        height = h;

        if (clickIndex >= 0) {
            actives = items.map((_, idx) => idx === clickIndex);
            let t = STEP * clickIndex;
            if (t + h > lastBottom) t = lastBottom - h;
            top = Math.max(0, t);
        } else {
            actives = childsVis.map(c => c.ratio > 0);
            let t = STEP * firstIndex + first.offset * STEP;
            if (t + h > lastBottom) t = lastBottom - h;
            top = Math.max(0, t);
        }
    };

    const toIndex = (index: number) => {
        if (!navEl || !mainEl) return;
        clickIndex = index;
        navEl.children[index]?.scrollIntoView({ behavior: "smooth", block: "center" });
        mainEl.children[index]?.scrollIntoView();
        computed(mainEl);
        setTimeout(() => { clickIndex = -1; }, 500);
    };

    const onScroll = useDebounce((e: Event) => {
        if (clickIndex >= 0) return;
        computed(e.target as HTMLElement);
    }, 32);

    $effect(() => { if (mainEl) computed(mainEl); });
</script>

<div class="navTab">
    <nav bind:this={navEl} style="--top: {top}px; --height: {height}px">
        {#each items as item, i}
            <div role="tab" tabindex="0" class:active={actives[i] ?? false}
                onclick={() => toIndex(i)}
                onkeydown={(e) => e.key === "Enter" && toIndex(i)}>
                {item.name}
            </div>
        {/each}
    </nav>

    <div role="region" bind:this={mainEl} onscroll={onScroll}>
        {#each items as item}
            <div>{@render item.panel()}</div>
        {/each}
    </div>
</div>

<style>
    .navTab { display: flex; height: 100vh; overflow: hidden; }
    .navTab > nav { width: 96px; flex-shrink: 0; overflow-y: auto; position: relative; background: var(--sunken-bg); padding: 8px 0; }
    .navTab > nav > div { height: 48px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 13px; color: var(--sunken-fg); transition: color 160ms ease; padding: 0 8px; text-align: center; }
    .navTab > nav > div.active { color: var(--accent-color); font-weight: 600; }
    .navTab > [role="region"] { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; }
    .navTab > [role="region"] > div { min-height: 60vh; padding: 16px; border-bottom: 1px solid var(--sunken-bg); }
</style>
