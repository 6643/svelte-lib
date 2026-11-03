<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';
	import { untrack } from 'svelte';
	import { useScrollEnd } from './hooks/useScrollEnd.ts';

	type Row = { item: T; index: number };

	type Props = {
		items: T[];
		children?: Snippet<[T, number]>;
		filter?: (item: T, index?: number) => boolean;
		// 需要出现在窗口中的目标行号; 可用 `bind:index` 回写首个可见行
		index?: number;
	};

	let { items, children, filter, index = $bindable(0) }: Props = $props();

	// 可见行数先按缺省值估, 首次滚动后按真实可见行数修正
	let visibleCount = $state(8);
	let start = $state(0);
	let el = $state<HTMLDivElement>();
	// 自身回写引起的 index 变化不再回推窗口, 避免回环
	let ignoredIndex: number | undefined;

	const filtered = $derived(filter ? items.filter(filter) : items);
	// 上下各留 visibleCount/3 的缓冲, 渲染总数是可见数的两倍
	const hideItems = $derived(Math.max(0, Math.floor(visibleCount / 3)));
	const renderCount = $derived(Math.max(1, visibleCount + hideItems * 3));

	const clampStart = (value: number, itemCount: number, count: number): number =>
		Math.max(0, Math.min(value, Math.max(0, itemCount - count)));

	const rows = $derived.by<Row[]>(() =>
		filtered.slice(start, start + renderCount).map((item, offset) => ({
			item,
			index: start + offset
		}))
	);

	// 首个可见行号; 顺带用真实可见行数修正 visibleCount.
	const measureFirstVisible = (): number | undefined => {
		if (!el) return undefined;

		const box = el.getBoundingClientRect();
		const visible = Array.from(el.querySelectorAll<HTMLElement>('[data-index]')).filter((row) => {
			const rect = row.getBoundingClientRect();
			return rect.bottom > box.top && rect.top < box.bottom;
		});

		const first = visible[0];
		if (!first) return undefined;

		visibleCount = Math.max(1, visible.length);
		const value = Number(first.dataset.index);
		return Number.isFinite(value) ? value : undefined;
	};

	$effect(() => {
		const target = index;
		if (ignoredIndex === target) {
			ignoredIndex = undefined;
			return;
		}

		const list = untrack(() => filtered);
		const count = untrack(() => renderCount);

		if (list.length === 0) {
			start = 0;
			return;
		}

		const clamped = Math.max(0, Math.min(target, list.length - 1));
		const nextStart = clampStart(clamped, list.length, count);
		if (nextStart !== untrack(() => start)) start = nextStart;

		// 等窗口内的行渲染出来再滚
		queueMicrotask(() => {
			el?.querySelector<HTMLElement>(`[data-index="${clamped}"]`)?.scrollIntoView({
				block: 'start'
			});
		});
	});

	// 把指定行吸附到容器上沿, 消除半行截断.
	const scrollFirstRowToTop = (rowIndex: number) => {
		if (!el) return;

		const row = el.querySelector<HTMLElement>(`[data-index="${rowIndex}"]`);
		if (!row) return;

		const offset = row.getBoundingClientRect().top - el.getBoundingClientRect().top;
		if (offset !== 0) el.scrollTop += offset;
	};

	const onScrollEnd = () => {
		const list = untrack(() => filtered);
		const first = measureFirstVisible();
		if (first === undefined || !el) return;

		// 窗口上沿留在可见首行上方 hideItems 行处
		const nextStart = clampStart(first - hideItems, list.length, renderCount);
		if (nextStart !== untrack(() => start)) start = nextStart;
		scrollFirstRowToTop(first);

		if (first !== index) {
			ignoredIndex = first;
			index = first;
		}
	};
</script>

<div bind:this={el} class="list-box" {@attach useScrollEnd(onScrollEnd)}>
	{#each rows as row (row.index)}
		<div data-index={row.index}>
			{@render children?.(row.item, row.index)}
		</div>
	{/each}
</div>

<style>
	.list-box {
		display: grid;
		width: inherit;
		height: inherit;
		overflow-y: auto;
		grid-auto-rows: auto;
		gap: 4px;
	}
</style>
