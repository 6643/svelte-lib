<script lang="ts">
    import type { Snippet } from "svelte";

    type Pos = { x?: number; y?: number };

    type Props = {
        children: Snippet;
        /** 每个子元素的位置偏移：负数 = 右/下，正数 = 左/上 */
        pos?: Pos[];
    };

    let { children, pos }: Props = $props();

    let container: HTMLDivElement | undefined;

    $effect(() => {
        const _pos = pos;
        if (!container) return;
        queueMicrotask(() => {
            const c = container!;
            const nodes = Array.from(c.children) as HTMLElement[];
            nodes.forEach((child, i) => {
                const p = _pos?.[i];
                if (!p) return;
                if (p.x) {
                    child.style.setProperty(p.x < 0 ? "--right" : "--left", String(Math.abs(p.x)));
                }
                if (p.y) {
                    child.style.setProperty(p.y < 0 ? "--bottom" : "--top", String(Math.abs(p.y)));
                }
            });
        });
    });
</script>

<div bind:this={container} class="stack-box">
    {@render children()}
</div>

<style>
    .stack-box {
        width: 100%;
        height: calc(1px * var(--height, 160));
        background: var(--bg, var(--accent-color));
        display: grid;
        place-items: center;
        position: relative;
    }

    .stack-box > :global(*) {
        position: absolute;
        left: calc(1px * var(--left));
        right: calc(1px * var(--right));
        top: calc(1px * var(--top));
        bottom: calc(1px * var(--bottom));
    }
</style>
