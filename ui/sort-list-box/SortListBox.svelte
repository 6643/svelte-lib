<script>
    import { icon_drag_handle } from "../icons.ts";
    import { reorderItems } from "./reorder.ts";

    export let actions = undefined;
    export let hookChange = () => {};
    export let items = [];
    export let renderItem;

    let containerEl = undefined;
    let dragState = null;

    const calculateAvgItemSize = (itemElements) => {
        if (itemElements.length === 0) return 0;
        if (itemElements.length === 1) return itemElements[0].getBoundingClientRect().height;

        const firstRect = itemElements[0].getBoundingClientRect();
        const secondRect = itemElements[1].getBoundingClientRect();
        return firstRect.height + (secondRect.top - firstRect.bottom);
    };

    const cleanupDrag = () => {
        document.removeEventListener("pointermove", handlePointerMove);
        document.removeEventListener("pointerup", handlePointerUp);
        dragState = null;
    };

    const handlePointerDown = (event) => {
        if (!containerEl || event.button !== 0 || !event.isPrimary) return;

        const target = event.target;
        const dragHandle = target.closest(".drag-handle");
        if (!dragHandle) return;

        const draggedEl = dragHandle.closest(".list-item");
        if (!draggedEl) return;

        event.preventDefault();

        const itemElements = Array.from(containerEl.children);
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
        };

        document.addEventListener("pointermove", handlePointerMove);
        document.addEventListener("pointerup", handlePointerUp);
    };

    const handlePointerMove = (event) => {
        if (!containerEl || !dragState) return;

        const { avgItemSize, draggedEl, initialIndex, initialMouseY } = dragState;
        const itemElements = Array.from(containerEl.children);
        const deltaY = event.clientY - initialMouseY;
        const maxIndex = itemElements.length - 1;
        const nextIndex = Math.max(0, Math.min(initialIndex + Math.round(deltaY / avgItemSize), maxIndex));

        draggedEl.style.setProperty("--translate-y", `${deltaY}px`);

        itemElements.forEach((itemEl, index) => {
            if (itemEl === draggedEl) return;

            let translateY = 0;
            if (initialIndex < nextIndex && index > initialIndex && index <= nextIndex) {
                translateY = -avgItemSize;
            }
            if (initialIndex > nextIndex && index >= nextIndex && index < initialIndex) {
                translateY = avgItemSize;
            }

            itemEl.style.setProperty("--translate-y", `${translateY}px`);
        });

        dragState = { ...dragState, currentIndex: nextIndex };
    };

    const handlePointerUp = () => {
        if (!containerEl || !dragState) return;

        const { currentIndex, draggedEl, initialIndex } = dragState;
        cleanupDrag();

        const itemElements = Array.from(containerEl.children);
        itemElements.forEach((itemEl) => {
            itemEl.style.removeProperty("--translate-y");
            itemEl.style.removeProperty("opacity");
            itemEl.style.removeProperty("z-index");
            itemEl.style.removeProperty("box-shadow");
            itemEl.classList.remove("dragging", "displaced");
        });

        if (currentIndex !== initialIndex) {
            hookChange(reorderItems(items, initialIndex, currentIndex), initialIndex, currentIndex);
        }

        draggedEl.style.removeProperty("--translate-y");
    };
</script>

<div bind:this={containerEl} class="sort-list-box" on:pointerdown={handlePointerDown}>
    {#each items as item, index}
        <div class="list-item">
            <div class="item-body">
                {@render renderItem(item, index)}
            </div>

            <div class="item-actions">
                {#if actions}
                    {@render actions(item, index)}
                {/if}

                <button class="drag-handle" type="button">
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
