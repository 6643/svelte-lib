<script lang="ts">
    import type { Snippet } from "svelte";

    type FlexDir = "row" | "row-reverse" | "column" | "column-reverse";
    type FlexWrap = "nowrap" | "wrap" | "wrap-reverse";
    type AlignItems = "flex-start" | "flex-end" | "center" | "baseline" | "stretch";
    type JustifyContent = "flex-start" | "flex-end" | "center" | "space-between" | "space-around" | "space-evenly";
    type AlignContent = "flex-start" | "flex-end" | "center" | "space-between" | "space-around" | "stretch";
    type AlignSelf = "auto" | "flex-start" | "flex-end" | "center" | "baseline" | "stretch";

    type Props = {
        children: Snippet;
        dir?: FlexDir;
        wrap?: FlexWrap;
        ai?: AlignItems;
        jc?: JustifyContent;
        ac?: AlignContent;
        gap?: number;
        /** 逐个子元素的 align-self */
        as?: AlignSelf[];
        /** 逐个子元素的 flex-grow */
        fg?: number[];
        /** 逐个子元素的 flex-shrink */
        fs?: number[];
        /** 逐个子元素的 order */
        order?: number[];
        class?: string;
        style?: string;
    };

    let { children, dir, wrap, ai, jc, ac, gap, as: as_, fg, fs, order, class: className, style }: Props = $props();

    let container: HTMLDivElement | undefined;

    $effect(() => {
        const _as = as_;
        const _fg = fg;
        const _fs = fs;
        const _order = order;
        if (!container) return;
        // 等 DOM 更新后再操作子元素
        queueMicrotask(() => {
            const c = container!;
            const nodes = Array.from(c.children) as HTMLElement[];
            nodes.forEach((child, i) => {
                if (_as?.[i]) child.style.alignSelf = _as[i];
                if (_fg?.[i]) child.style.flexGrow = String(_fg[i]);
                if (_fs?.[i]) child.style.flexShrink = String(_fs[i]);
                if (_order?.[i]) child.style.order = String(_order[i]);
            });
        });
    });
</script>

<div
    bind:this={container}
    class="flex-box {className ?? ''}"
    style="--dir: {dir ?? 'row'}; --wrap: {wrap ?? 'nowrap'}; --align: {ai ?? 'stretch'}; --justify: {jc ?? 'flex-start'}; --ac: {ac ?? 'flex-start'}; --gap: {gap ?? 4}; {style ?? ''}"
    role="list"
>
    {@render children()}
</div>

<style>
    .flex-box {
        width: inherit;
        height: inherit;
        display: flex;
        flex-direction: var(--dir, row);
        flex-wrap: var(--wrap, nowrap);
        align-items: var(--align, stretch);
        justify-content: var(--justify, flex-start);
        gap: calc(1px * var(--gap, 4));
        margin-top: 4px;
    }
</style>
