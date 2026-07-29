<script lang="ts">
    import type { Snippet } from "svelte";
    import SvgIcon from "./SvgIcon.svelte";
    import { icon_chevron_right } from "./svgicons";

    type Props = { title: string; children: Snippet };

    let { title, children }: Props = $props();
    let visible = $state(false);
    let active = $state(false);

    $effect(() => {
        if (visible) { active = true; return; }
        const timer = setTimeout(() => { active = false; }, 400);
        return () => clearTimeout(timer);
    });

    const toggle = () => { visible = !visible; };
</script>

<div class="expand" class:active={visible}>
    <div role="button" tabindex="0" onclick={toggle} onkeydown={(e) => e.key === "Enter" && toggle()}>
        <span>{title}</span>
        <SvgIcon svgPaths={icon_chevron_right} size={24} />
    </div>
    {#if active}
        <div>{@render children()}</div>
    {/if}
</div>

<style>
    .expand { display: grid; grid-template-rows: 48px 1fr; }
    .expand > [role="button"] { user-select: none; padding: 8px; display: flex; justify-content: space-between; align-items: center; color: var(--color); background-color: var(--sunken-bg); transition-duration: 512ms; cursor: pointer; }
    .expand > [role="button"] > :last-child { transition-duration: 512ms; }
    .expand > div { padding: 8px; animation-duration: 512ms; }
    .expand.active > [role="button"] { background-color: var(--accent-color); --color: var(--sunken-bg); }
    .expand.active > [role="button"] > :last-child { transform: rotate(90deg); }
    .expand.active > div { background-color: var(--sunken-bg); animation-name: open; }
    .expand:not(.active) > div { animation-name: close; }
    @keyframes open { from { opacity: 0; transform: translateX(100%); } to { opacity: 1; transform: translateX(0); } }
    @keyframes close { from { opacity: 1; transform: translateX(0); } to { opacity: 0; transform: translateX(100%); } }
</style>
