<script lang="ts">
    import type { Snippet } from "svelte";

    type Props = {
        children: Snippet;
        columns?: string;
        rows?: string;
        areas?: string;
        gap?: number;
        class?: string;
        style?: string;
    };

    let { children, columns, rows, areas, gap, class: className, style }: Props = $props();

    /** 转换 areas 格式："a,b;c,d" → '"_a _b" "_c _d"' */
    const toAreas = (str: string): string => {
        const parts = str.replace(/ /g, "").split(";").map(part => {
            const [first, second] = part.split(",");
            if (!first || !second) return "";
            return `"_${first} _${second}"`;
        });
        return parts.filter(Boolean).join(" ");
    };

    let container: HTMLDivElement | undefined;

    $effect(() => {
        const _areas = areas;
        if (!container) return;
        queueMicrotask(() => {
            const c = container!;
            const nodes = Array.from(c.children) as HTMLElement[];
            nodes.forEach((child, i) => {
                const idx = (i + 1).toString();
                child.style.gridArea = /^\d+$/.test(idx) ? `_${idx}` : idx;
            });
        });
    });
</script>

<div
    bind:this={container}
    class="grid-box {className ?? ''}"
    style="--columns: {columns ?? ''}; --rows: {rows ?? ''}; --areas: {areas ? toAreas(areas) : ''}; --gap: {gap ?? 4}; {style ?? ''}"
    role="grid"
>
    {@render children()}
</div>

<style>
    .grid-box {
        width: inherit;
        height: inherit;
        display: grid;
        grid-template-columns: var(--columns);
        grid-template-rows: var(--rows);
        grid-template-areas: var(--areas);
        gap: calc(1px * var(--gap, 4));
    }
</style>
