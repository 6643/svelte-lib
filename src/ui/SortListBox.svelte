<script lang="ts" generics="T">
    import type { Snippet } from "svelte";

    import { icon_drag_handle } from "./icons.ts";
    import { getDragTranslateY, resolveDragIndex } from "./SortListBox.drag-layout.ts";
    import { reorderItems } from "./SortListBox.reorder.ts";

    let {
        actions = undefined as Snippet<[T, number]> | undefined,
        hookChange = (() => {}) as (items: T[], fromIndex: number, toIndex: number) => void,
        items = [] as T[],
        renderItem = undefined as unknown as Snippet<[T, number]>,
    } = $props();

    let containerEl = undefined as HTMLDivElement | undefined;
    let dragState = null as
        | {
              avgItemSize: number;
              currentIndex: number;
              draggedEl: HTMLElement;
              initialIndex: number;
              initialMouseY: number;
              itemElements: HTMLElement[];
          }
        | null;

    const calculateAvgItemSize = ((itemElements) => {
        if (itemElements.length === 0) return 0;
        if (itemElements.length === 1) return itemElements[0].getBoundingClientRect().height;

        const firstRect = itemElements[0].getBoundingClientRect();
        const secondRect = itemElements[1].getBoundingClientRect();
        return firstRect.height + (secondRect.top - firstRect.bottom);
    }) as (itemElements: HTMLElement[]) => number;

    const cleanupDrag = () => {
        document.removeEventListener("pointermove", handlePointerMove);
        document.removeEventListener("pointerup", handlePointerUp);
        document.removeEventListener("pointercancel", handlePointerCancel);
        dragState = null;
    };

    $effect(() => cleanupDrag);

    const finishDrag = (shouldCommit: boolean) => {
        if (!containerEl || !dragState) return;

        const { currentIndex, draggedEl, initialIndex } = dragState;
        cleanupDrag();

        const itemElements = Array.from(containerEl.children) as HTMLElement[];
        itemElements.forEach((itemEl) => {
            itemEl.style.removeProperty("--translate-y");
            itemEl.style.removeProperty("opacity");
            itemEl.style.removeProperty("z-index");
            itemEl.style.removeProperty("box-shadow");
            itemEl.classList.remove("dragging", "displaced");
        });

        if (shouldCommit && currentIndex !== initialIndex) {
            hookChange(reorderItems(items, initialIndex, currentIndex), initialIndex, currentIndex);
        }

        draggedEl.style.removeProperty("--translate-y");
    };

    const handlePointerDown = ((event) => {
        if (!containerEl || event.button !== 0 || !event.isPrimary) return;

        const target = event.target as Element | null;
        if (!target) return;
        const dragHandle = target.closest(".drag-handle");
        if (!dragHandle) return;

        const draggedEl = dragHandle.closest(".list-item") as HTMLElement | null;
        if (!draggedEl) return;

        event.preventDefault();

        const itemElements = Array.from(containerEl.children) as HTMLElement[];
        const initialIndex = itemElements.indexOf(draggedEl);
        if (initialIndex === -1) return;

        const avgItemSize = calculateAvgItemSize(itemElements);

        draggedEl.classList.add("dragging");
        draggedEl.style.opacity = "0.85";
        draggedEl.style.zIndex = "1";
        draggedEl.style.boxShadow = "0 10px 24px rgba(0, 0, 0, 0.12)";
        itemElements.forEach((itemEl) => {
            if (itemEl !== draggedEl) itemEl.classList.add("displaced");
        });

        dragState = {
            avgItemSize,
            currentIndex: initialIndex,
            draggedEl,
            initialIndex,
            initialMouseY: event.clientY,
            itemElements,
        };

        document.addEventListener("pointermove", handlePointerMove);
        document.addEventListener("pointerup", handlePointerUp);
        document.addEventListener("pointercancel", handlePointerCancel);
    }) as (event: PointerEvent) => void;

    const handlePointerMove = ((event) => {
        if (!containerEl || !dragState) return;

        const { avgItemSize, currentIndex, draggedEl, initialIndex, initialMouseY, itemElements } = dragState;
        const deltaY = event.clientY - initialMouseY;
        const nextIndex = resolveDragIndex(initialIndex, deltaY, avgItemSize, itemElements.length);

        draggedEl.style.setProperty("--translate-y", `${deltaY}px`);

        if (nextIndex === currentIndex) return;

        itemElements.forEach((itemEl, index) => {
            if (itemEl === draggedEl) return;
            itemEl.style.setProperty("--translate-y", `${getDragTranslateY(initialIndex, nextIndex, index, avgItemSize)}px`);
        });

        dragState = { ...dragState, currentIndex: nextIndex };
    }) as (event: PointerEvent) => void;

    const handlePointerUp = () => finishDrag(true);

    const handlePointerCancel = () => finishDrag(false);
</script>

<div bind:this={containerEl} class="sort-list-box">
    {#each items as item, index}
        <div class="list-item">
            <div class="item-body">
                {@render renderItem(item, index)}
            </div>

            <div class="item-actions">
                {#if actions}
                    {@render actions(item, index)}
                {/if}

                <button
                    aria-label={`Reorder item ${index + 1}`}
                    class="drag-handle"
                    onpointerdown={handlePointerDown}
                    type="button"
                >
                    <svg viewBox="0 -960 960 960" aria-hidden="true">
                        {@html icon_drag_handle}
                    </svg>
                </button>
            </div>
        </div>
    {/each}
</div>

<style>
    .sort-list-box {
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .list-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px;
        background-color: var(--sb-color, #f4f4f4);
        border-radius: 9px;
        transform: translateY(var(--translate-y, 0));
        transition: transform 180ms ease;
    }

    .item-body {
        flex: 1;
        min-width: 0;
    }

    .item-actions {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .drag-handle {
        width: 36px;
        height: 36px;
        border: none;
        border-radius: 999px;
        background: transparent;
        color: var(--pf-color, #444);
        cursor: grab;
    }

    .drag-handle svg {
        width: 20px;
        height: 20px;
        fill: currentColor;
    }
</style>
