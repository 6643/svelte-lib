<script lang="ts">
    import type { Snippet } from "svelte";

    type VisibleBounds = {
        firstVisibleRow: HTMLElement;
        lastVisibleRow: HTMLElement;
        visibleCount: number;
    };

    type Props<T> = {
        items: T[];
        children: Snippet<[T, number]>;
        filter?: (item: T, index?: number) => boolean;
        index?: number;
        changed?: (index: number) => void;
    };

    let { items: rawItems, children: renderItem, filter, index: externalIndex, changed }: Props<any> = $props();

    let items = $derived(filter ? rawItems.filter(filter) : rawItems);

    let containerEl: HTMLDivElement | undefined;
    let start = $state(0);
    let rows = $state<{ item: any; index: number }[]>([]);
    let visibleCount = $state(8);
    let ignoredScrollTop: number | undefined;
    let ignoredIndex: number | undefined;

    // ── 工具 ──
    const getHideItems = () => Math.max(0, Math.floor(visibleCount / 3));
    const getRenderCount = () => Math.max(1, visibleCount + getHideItems() * 3);

    const clampStart = (s: number, count: number, rc = getRenderCount()) =>
        Math.max(0, Math.min(s, Math.max(0, count - rc)));

    const createRows = (items: any[], s: number, count = getRenderCount()) =>
        items.slice(s, s + count).map((item, offset) => ({ item, index: s + offset }));

    const appendRows = (oldRows: { item: any; index: number }[], items: any[], s: number, delta: number, rc: number) => {
        const keep = Math.max(0, oldRows.length - delta);
        const append = Math.max(0, rc - keep);
        return [...oldRows.slice(delta), ...createRows(items, s + oldRows.length, append)];
    };

    const prependRows = (oldRows: { item: any; index: number }[], items: any[], s: number, delta: number, rc: number) => {
        const keep = Math.max(0, oldRows.length - delta);
        const prepend = Math.max(0, rc - keep);
        return [...createRows(items, s, prepend), ...oldRows.slice(0, keep)];
    };

    // ── DOM 测量 ──
    const getVisibleBounds = (el: HTMLElement): VisibleBounds | undefined => {
        const box = el.getBoundingClientRect();
        const rowEls = Array.from(el.querySelectorAll<HTMLElement>("[data-index]"));
        const visible = rowEls.filter(r => {
            const rect = r.getBoundingClientRect();
            return rect.bottom > box.top && rect.top < box.bottom;
        });
        if (visible.length === 0) return;
        return { firstVisibleRow: visible[0]!, lastVisibleRow: visible[visible.length - 1]!, visibleCount: visible.length };
    };

    const getRowOffset = (el: HTMLElement, index: number, edge: "top" | "bottom") => {
        const row = el.querySelector<HTMLElement>(`[data-index="${index}"]`);
        if (!row) return;
        const rowRect = row.getBoundingClientRect();
        const box = el.getBoundingClientRect();
        return edge === "top" ? rowRect.top - box.top : rowRect.bottom - box.bottom;
    };

    // ── 窗口操作 ──
    const setWindow = (s: number, allItems = items, rc = getRenderCount()) => {
        const next = clampStart(s, allItems.length, rc);
        start = next;
        rows = createRows(allItems, next, rc);
        return next;
    };

    const shiftWindow = (delta: number, el: HTMLElement, anchorRow: HTMLElement, rc: number) => {
        const currentStart = start;
        const nextStart = clampStart(currentStart + delta, items.length, rc);
        if (nextStart === currentStart) return;
        const amount = Math.abs(nextStart - currentStart);

        if (rows.length !== rc || amount >= rc) {
            setWindow(nextStart, items, rc);
        } else {
            start = nextStart;
            rows = nextStart > currentStart
                ? appendRows(rows, items, currentStart, amount, rc)
                : prependRows(rows, items, nextStart, amount, rc);
        }

        queueMicrotask(() => {
            const idx = Number(anchorRow.dataset.index);
            if (!Number.isFinite(idx)) return;
            const offset = getRowOffset(el, idx, "top");
            if (offset !== undefined && offset !== 0) {
                ignoredScrollTop = Math.max(0, el.scrollTop + offset);
                el.scrollTop = ignoredScrollTop;
            }
            notifyVisibleIndex(el);
        });
    };

    const settleWindow = (el: HTMLElement, currentStart: number, rc: number, hideItems: number, firstVisibleRow: HTMLElement) => {
        const firstVisibleIndex = Number(firstVisibleRow.dataset.index);
        if (!Number.isFinite(firstVisibleIndex)) return true;
        const topHidden = firstVisibleIndex - currentStart;
        const targetHidden = currentStart === 0 ? 0 : hideItems;
        const delta = topHidden - targetHidden;
        if (delta !== 0) { shiftWindow(delta, el, firstVisibleRow, rc); return false; }
        return true;
    };

    // ── 通知 ──
    const notifyChanged = (idx: number) => {
        if (!changed) return;
        ignoredIndex = idx;
        changed(idx);
        queueMicrotask(() => { if (ignoredIndex === idx) ignoredIndex = undefined; });
    };

    const notifyVisibleIndex = (el: HTMLElement) => {
        const vb = getVisibleBounds(el);
        if (!vb) return;
        const idx = Number(vb.firstVisibleRow.dataset.index);
        if (Number.isFinite(idx)) notifyChanged(idx);
    };

    // ── 外部 index → 滚动 ──
    $effect(() => {
        const allItems = items;
        const idx = externalIndex;
        if (idx == null) return;
        if (ignoredIndex === idx) { ignoredIndex = undefined; return; }
        if (allItems.length === 0) { setWindow(0, allItems); return; }
        const target = Math.max(0, Math.min(idx, allItems.length - 1));
        const rc = getRenderCount();
        const s = clampStart(target, allItems.length, rc);
        if (rows.length !== rc || Math.abs(s - start) >= rc) {
            setWindow(s, allItems, rc);
        } else {
            const amount = Math.abs(s - start);
            if (s > start) rows = appendRows(rows, allItems, start, amount, rc);
            else rows = prependRows(rows, allItems, s, amount, rc);
            start = s;
        }
        queueMicrotask(() => {
            if (!containerEl) return;
            const targetEl = containerEl.querySelector<HTMLElement>(`[data-index="${target}"]`);
            const prev = containerEl.scrollTop;
            targetEl?.scrollIntoView({ block: "start" });
            if (containerEl.scrollTop !== prev) ignoredScrollTop = containerEl.scrollTop;
        });
    });

    // ── 滚动停稳检测 ──
    let settleTimer: ReturnType<typeof setTimeout> | undefined;

    const onScroll = (e: Event) => {
        if (settleTimer) clearTimeout(settleTimer);
        settleTimer = setTimeout(() => settleScroll(e.target as HTMLElement), 64);
    };

    const settleScroll = (el: HTMLElement) => {
        const st = el.scrollTop;
        if (ignoredScrollTop === st) { ignoredScrollTop = undefined; return; }

        const vb = getVisibleBounds(el);
        if (!vb) return;
        const vc = Math.max(1, vb.visibleCount);
        const hideItems = Math.max(0, Math.floor(vc / 3));
        const rc = Math.max(1, vc + hideItems * 3);
        const firstVisibleRow = vb.firstVisibleRow;
        const firstVisibleIndex = Number(firstVisibleRow.dataset.index);
        if (!Number.isFinite(firstVisibleIndex)) return;

        if (rows.length !== rc) {
            visibleCount = vc;
            setWindow(firstVisibleIndex - hideItems, items, rc);
            queueMicrotask(() => notifyVisibleIndex(el));
            return;
        }

        visibleCount = vc;
        if (!settleWindow(el, start, rc, hideItems, firstVisibleRow)) return;
        notifyVisibleIndex(el);
    };

    // ── 初始化 ──
    $effect(() => {
        if (items.length > 0 && rows.length === 0) setWindow(0, items);
    });
</script>

<div class="listBox" bind:this={containerEl} onscroll={onScroll}>
    {#each rows as row}
        <div data-index={row.index}>{@render renderItem(row.item, row.index)}</div>
    {/each}
</div>

<style>
    .listBox { overflow-y: auto; height: 100%; -webkit-overflow-scrolling: touch; }
</style>
