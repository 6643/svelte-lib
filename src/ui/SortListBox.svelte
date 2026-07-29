<script lang="ts">
    import type { Snippet } from "svelte";
    import SvgIcon from "./SvgIcon.svelte";
    import { icon_drag_handle } from "./svgicons";

    type DragState = {
        draggedEl: HTMLElement;
        initialMouseY: number;
        initialIndex: number;
        currentVisualIndex: number;
        itemInitialRects: Map<HTMLElement, DOMRect>;
        avgItemSize: number;
    };

    const calculateAvgItemSize = (itemRects: Map<HTMLElement, DOMRect>): number => {
        const rects = Array.from(itemRects.values());
        if (rects.length === 0) return 0;
        if (rects.length === 1) return rects[0].height;
        const gap = rects[1].top - rects[0].bottom;
        return rects[0].height + gap;
    };

    type Props<T> = {
        items: T[];
        hookChange: (items: T[], oldIndex: number, newIndex: number) => void;
        renderItem: Snippet<[T, number]>;
        actions?: Snippet<[T, number]>;
    };

    let { items, hookChange, renderItem, actions }: Props<any> = $props();

    let containerEl: HTMLDivElement | undefined;
    let dragState: DragState | null = $state(null);

    const updateSiblingTransforms = (state: DragState, newVisualIndex: number) => {
        const { draggedEl, initialIndex, avgItemSize } = state;
        if (!containerEl) return;
        const listItems = Array.from(containerEl.children) as HTMLElement[];
        listItems.forEach((item, i) => {
            if (item === draggedEl) return;
            let translateY = 0;
            if (initialIndex < newVisualIndex) {
                if (i > initialIndex && i <= newVisualIndex) translateY = -avgItemSize;
            } else if (initialIndex > newVisualIndex) {
                if (i >= newVisualIndex && i < initialIndex) translateY = avgItemSize;
            }
            item.style.setProperty("--translate-y", `${translateY}px`);
        });
    };

    const handlePointerDown = (e: PointerEvent) => {
        if (e.button !== 0 || !e.isPrimary || !containerEl) return;
        const target = e.target as HTMLElement;
        const dragHandle = target.closest<HTMLElement>(".itemActions > :last-child");
        if (!dragHandle) return;
        const draggedEl = dragHandle.closest<HTMLElement>(".listItem");
        if (!draggedEl) return;
        e.preventDefault();

        const listItems = Array.from(containerEl.children) as HTMLElement[];
        const initialIndex = listItems.indexOf(draggedEl);
        if (initialIndex === -1) return;

        const itemInitialRects = new Map<HTMLElement, DOMRect>();
        listItems.forEach(item => {
            itemInitialRects.set(item, item.getBoundingClientRect());
            if (item !== draggedEl) item.dataset.displaced = "true";
        });
        const avgItemSize = calculateAvgItemSize(itemInitialRects);

        dragState = { draggedEl, initialMouseY: e.clientY, initialIndex, currentVisualIndex: initialIndex, itemInitialRects, avgItemSize };
        draggedEl.dataset.dragging = "true";

        document.addEventListener("pointermove", handlePointerMove);
        document.addEventListener("pointerup", handlePointerUp);
    };

    const handlePointerMove = (e: PointerEvent) => {
        const state = dragState;
        if (!state) return;
        const { draggedEl, initialMouseY, initialIndex, avgItemSize, currentVisualIndex, itemInitialRects } = state;
        const itemCount = itemInitialRects.size;
        const deltaY = e.clientY - initialMouseY;
        const minDeltaY = -initialIndex * avgItemSize;
        const maxDeltaY = (itemCount - 1 - initialIndex) * avgItemSize;
        const clampedDeltaY = Math.max(minDeltaY, Math.min(deltaY, maxDeltaY));
        draggedEl.style.setProperty("--translate-y", `${clampedDeltaY}px`);

        if (avgItemSize <= 0) return;
        const newVisualIndex = initialIndex + Math.round(deltaY / avgItemSize);
        const clampedNewIndex = Math.max(0, Math.min(newVisualIndex, itemCount - 1));
        if (clampedNewIndex !== currentVisualIndex) {
            updateSiblingTransforms(state, clampedNewIndex);
            dragState = { ...dragState!, currentVisualIndex: clampedNewIndex };
        }
    };

    const handlePointerUp = () => {
        const state = dragState;
        if (!state) return;
        document.removeEventListener("pointermove", handlePointerMove);
        document.removeEventListener("pointerup", handlePointerUp);

        const { initialIndex, currentVisualIndex } = state;

        if (currentVisualIndex !== initialIndex) {
            const newItems = [...items];
            const [movedItem] = newItems.splice(initialIndex, 1);
            newItems.splice(currentVisualIndex, 0, movedItem!);
            hookChange(newItems, initialIndex, currentVisualIndex);
        }

        dragState = null;
        queueMicrotask(() => {
            if (!containerEl) return;
            Array.from(containerEl.children).forEach(item => {
                (item as HTMLElement).style.removeProperty("--translate-y");
                delete (item as HTMLElement).dataset.dragging;
                delete (item as HTMLElement).dataset.displaced;
            });
            const target = containerEl.children[currentVisualIndex] as HTMLElement | undefined;
            target?.scrollIntoView({ block: "start" });
        });
    };

    $effect(() => {
        return () => {
            document.removeEventListener("pointermove", handlePointerMove);
            document.removeEventListener("pointerup", handlePointerUp);
        };
    });
</script>

<div class="sortListBox" bind:this={containerEl} onpointerdown={handlePointerDown} role="listbox" tabindex="0">
    {#each items as item, i}
        <div class="listItem" data-index={i}>
            {@render renderItem(item, i)}
            <div class="itemActions">
                {#if actions}{@render actions(item, i)}{/if}
                <SvgIcon svgPaths={icon_drag_handle} />
            </div>
        </div>
    {/each}
</div>

<style>
    .sortListBox { user-select: none; }

    .listItem {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px;
        transition: transform 160ms ease;
        transform: translateY(calc(1px * var(--translate-y, 0)));
    }

    .listItem {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px;
        transition: transform 160ms ease;
        transform: translateY(calc(1px * var(--translate-y, 0)));
    }

    .itemActions {
        display: flex;
        align-items: center;
        gap: 4px;
        cursor: grab;
    }

    .itemActions:active { cursor: grabbing; }
</style>
