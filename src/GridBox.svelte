<script lang="ts">
	import type { Snippet } from 'svelte';
	import { toGridAreas } from './utils/gridAreas.ts';
	import './childLayout.css';

	type Props = {
		children: Snippet;
		columns?: string;
		rows?: string;
		// "a,b;c,d" 形式的区域表
		areas?: string;
		gap?: number;
		className?: string;
		// 额外透传到根元素的 style 字符串
		style?: string;
	};

	let { children, columns, rows, areas, gap, className, style }: Props = $props();

	// "a,b;c,d" -> '"_a _b" "_c _d"', 与 solid 版一致: 空段丢弃 (纯函数见 utils/gridAreas.ts)
	const gridAreas = $derived(areas ? toGridAreas(areas) : undefined);

	// 子元素按序号自动落到同名网格区 (_1, _2, ...), 规则在 childLayout.css 里
	const boxStyle = $derived(
		[
			columns !== undefined && `--columns: ${columns}`,
			rows !== undefined && `--rows: ${rows}`,
			gap !== undefined && `--gap: ${gap}`,
			gridAreas !== undefined && `--areas: ${gridAreas}`,
			style
		]
			.filter(Boolean)
			.join('; ')
	);
</script>

<div class="grid-box {className}" style={boxStyle}>
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
