<script lang="ts">
    import type { Snippet } from "svelte";
    import SvgIcon from "./SvgIcon.svelte";

    type TabItem = { icon: string; panel: Snippet };
    type Props = { items: TabItem[] };

    let { items }: Props = $props();

    let scrollPos = $state<Record<string, number>>({});
    let activeIndex = $state(0);
    let spinDeg = $state(0);

    const toIndex = (index: number) => {
        if (index === activeIndex) return;
        activeIndex = index;
        spinDeg = spinDeg + (index < activeIndex ? -360 : 360);
    };

    const handleScroll = (i: number) => (e: Event) => {
        scrollPos[`bottom.tab.${i}`] = (e.target as HTMLElement).scrollTop;
    };
</script>

<div class="bottomTab">
    {#each items as item, i}
        {#if i === activeIndex}
            <div role="region" class:moveRight={i < activeIndex} class:moveLeft={i >= activeIndex} onscroll={handleScroll(i)}>
                {@render item.panel()}
            </div>
        {/if}
    {/each}

    <nav style="--len: {items.length}; --index: {activeIndex}; --spin: {spinDeg}deg">
        {#each items as item, i}
            <div role="tab" tabindex="0" class:active={i === activeIndex}
                onclick={() => toIndex(i)}
                onkeydown={(e) => e.key === "Enter" && toIndex(i)}>
                <SvgIcon svgPaths={item.icon} size={24} />
            </div>
        {/each}
    </nav>
</div>

<style>
    .bottomTab { display: flex; flex-direction: column; height: 100vh; overflow: hidden; }
    .bottomTab > [role="region"] { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; }
    .moveRight { animation: slideRight 240ms ease; }
    .moveLeft { animation: slideLeft 240ms ease; }
    @keyframes slideRight { from { opacity: 0; transform: translateX(-30px); } to { opacity: 1; transform: translateX(0); } }
    @keyframes slideLeft { from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: translateX(0); } }
    .bottomTab > nav { display: flex; justify-content: space-around; align-items: center; height: 56px; background: var(--raised-bg); border-top: 1px solid var(--sunken-bg); }
    .bottomTab > nav > div { display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 40px; cursor: pointer; color: var(--sunken-fg); transition: color 160ms ease; }
    .bottomTab > nav > div.active { color: var(--accent-color); }
</style>
