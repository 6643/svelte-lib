<script lang="ts" generics="T">
	import { tick, untrack } from 'svelte';
	import type { Snippet } from 'svelte';
	import SvgIcon from './SvgIcon.svelte';
	import { icon_drag_handle } from './svgicons.ts';

	type Props = {
		// 列表数据, 可 `bind:items`; 拖拽结束写入新顺序
		items: T[];
		// 每行的稳定身份, 用于 `{#each ... (key)}`.
		// 缺省回退到下标: 此时重排会复用到旧节点 (内容与行内状态可能错位),
		// 拖拽位移也按旧下标算, 因此列表内容会变时应当传 key.
		key?: (item: T, index: number) => unknown;
		// 拖拽结束回调 (bind:items 之外的旁路通知)
		onreorder?: (items: T[], oldIndex: number, newIndex: number) => void;
		// 每行内容
		children?: Snippet<[T, number]>;
		// 行尾操作区 (拖拽手柄之前的自定义按钮)
		itemActions?: Snippet<[T, number]>;
	};

	let { items = $bindable(), key, onreorder, children, itemActions }: Props = $props();

	// 缺省键: 下标, 与重构前的行为一致.
	const itemKey = $derived(key ?? ((_item: T, index: number) => index));

	type DragState = {
		draggedEl: HTMLElement;
		initialMouseY: number;
		initialIndex: number;
		currentVisualIndex: number;
		avgItemSize: number;
		itemCount: number;
	};

	let containerEl = $state<HTMLDivElement>();
	let drag = $state<DragState | undefined>(undefined);

	// 拖拽期间行高按首两行间距推算, 零高时退化为 0 (不做位移计算)
	const measureAvgItemSize = (nodes: HTMLElement[]): number => {
		if (nodes.length === 0) return 0;

		const first = nodes[0]!.getBoundingClientRect();
		if (nodes.length === 1) return first.height;

		const gap = nodes[1]!.getBoundingClientRect().top - first.bottom;
		return first.height + gap;
	};

	const setTranslate = (node: HTMLElement, value: number) => {
		node.style.setProperty('--translate-y', `${value}px`);
	};

	// 拖动项按 deltaY 位移; 其余行按需要反向让位
	const shiftSiblings = (state: DragState, nextIndex: number) => {
		const nodes = containerEl ? (Array.from(containerEl.children) as HTMLElement[]) : [];
		const { draggedEl, initialIndex, avgItemSize } = state;

		nodes.forEach((node, i) => {
			if (node === draggedEl) return;

			let offset = 0;
			if (initialIndex < nextIndex && i > initialIndex && i <= nextIndex) offset = -avgItemSize;
			if (initialIndex > nextIndex && i >= nextIndex && i < initialIndex) offset = avgItemSize;

			setTranslate(node, offset);
		});
	};

	const handlePointerMove = (event: PointerEvent) => {
		const state = drag;
		const node = containerEl;
		if (!state || !node) return;

		const { draggedEl, initialMouseY, initialIndex, avgItemSize, currentVisualIndex } = state;
		const deltaY = event.clientY - initialMouseY;

		// 位移限制在列表中, 首尾不越界
		const minDeltaY = -initialIndex * avgItemSize;
		const maxDeltaY = (state.itemCount - 1 - initialIndex) * avgItemSize;
		const clampedDeltaY = Math.max(minDeltaY, Math.min(deltaY, maxDeltaY));
		setTranslate(draggedEl, clampedDeltaY);

		if (avgItemSize <= 0) return;

		const visual = Math.max(
			0,
			Math.min(initialIndex + Math.round(deltaY / avgItemSize), state.itemCount - 1)
		);
		if (visual === currentVisualIndex) return;

		shiftSiblings(state, visual);
		drag = { ...state, currentVisualIndex: visual };
	};

	const cleanUpDrag = () => {
		document.removeEventListener('pointermove', handlePointerMove);
		document.removeEventListener('pointerup', handlePointerUp);
		drag = undefined;
	};

	const handlePointerUp = async () => {
		const state = drag;
		if (!state) return;

		cleanUpDrag();

		const { initialIndex, currentVisualIndex } = state;
		const nodes = containerEl ? (Array.from(containerEl.children) as HTMLElement[]) : [];

		if (currentVisualIndex !== initialIndex) {
			const next = [...items];
			const [moved] = next.splice(initialIndex, 1);
			next.splice(currentVisualIndex, 0, moved as T);
			items = next;
			onreorder?.(next, initialIndex, currentVisualIndex);
		}

		// 等 DOM 落到新顺序后再清内联位移, 否则旧节点会先弹回原位再跳
		await tick();
		nodes.forEach((node) => {
			node.style.removeProperty('--translate-y');
			node.classList.remove('dragging', 'displaced');
		});
		nodes[currentVisualIndex]?.scrollIntoView({ block: 'start' });
	};

	// 只认最后那个手柄: 行内的其它子元素不参与拖拽
	const handlePointerDown = (event: PointerEvent) => {
		if (event.button !== 0 || !event.isPrimary) return;

		const target = event.target as HTMLElement;
		const handle = target.closest<HTMLElement>('.item-actions > :last-child');
		if (!handle) return;

		const draggedEl = handle.closest<HTMLElement>('.list-item');
		if (!draggedEl || !containerEl) return;

		event.preventDefault();

		const nodes = Array.from(containerEl.children) as HTMLElement[];
		const initialIndex = nodes.indexOf(draggedEl);
		if (initialIndex === -1) return;

		const avgItemSize = measureAvgItemSize(nodes);
		nodes.forEach((node) => {
			if (node !== draggedEl) node.classList.add('displaced');
		});

		drag = {
			draggedEl,
			initialIndex,
			currentVisualIndex: initialIndex,
			initialMouseY: event.clientY,
			avgItemSize,
			itemCount: nodes.length
		};
		draggedEl.classList.add('dragging');

		document.addEventListener('pointermove', handlePointerMove);
		document.addEventListener('pointerup', handlePointerUp);
	};

	$effect(() => () => cleanUpDrag());

	// items 通过 bind:items 双向绑定, 拖拽结果直接写回
	void untrack(() => items.length);
</script>

<div bind:this={containerEl} class="sort-list-box" onpointerdown={handlePointerDown} role="list">
	{#each items as item, index (itemKey(item, index))}
		<div class="list-item" role="listitem">
			{@render children?.(item, index)}
			<div class="item-actions">
				{@render itemActions?.(item, index)}
				<SvgIcon svgPaths={icon_drag_handle} />
			</div>
		</div>
	{/each}
</div>

<style>
	.sort-list-box {
		display: flex;
		flex-direction: column;
		gap: 2px;
		user-select: none;
		background-color: var(--base-bg);
	}

	.sort-list-box > .list-item {
		position: relative;
		display: flex;
		gap: 4px;
		justify-content: space-between;
		user-select: none;
		background-color: var(--raised-bg);
		transform: translateY(var(--translate-y, 0));
	}

	.sort-list-box > :global(.list-item.dragging) {
		opacity: 0.9;
		z-index: 1;
	}

	/* TODO: 让位位移仍用 CSS transition — 它由 pointermove 逐事件写入, 再叠 RAF 补间
	   只会与指针事件打架; 还债条件: 需要跨行惯性/吸附动画时改用 Spring + preserveMomentum */
	.sort-list-box > :global(.list-item.displaced) {
		transition: transform 0.15s ease-out;
	}

	.sort-list-box > .list-item > :first-child {
		flex-grow: 1;
	}

	.sort-list-box > .list-item > .item-actions {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
	}

	.sort-list-box > .list-item > .item-actions > :global(:first-child) {
		flex-grow: 1;
	}

	.sort-list-box > .list-item > .item-actions > :global(:last-child) {
		box-sizing: content-box;
		border: 16px solid transparent;
		color: var(--raised-fg);
	}
</style>
