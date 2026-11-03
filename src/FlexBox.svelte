<script lang="ts">
	import type { Snippet } from 'svelte';
	import { toChildVars } from './utils/childLayout.ts';
	import './childLayout.css';

	type FlexDir = 'row' | 'row-reverse' | 'column' | 'column-reverse';
	type FlexWrap = 'nowrap' | 'wrap' | 'wrap-reverse';
	type AlignItems = 'flex-start' | 'flex-end' | 'center' | 'baseline' | 'stretch';
	type JustifyContent =
		| 'flex-start'
		| 'flex-end'
		| 'center'
		| 'space-between'
		| 'space-around'
		| 'space-evenly';
	type AlignContent = 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around' | 'stretch';
	type AlignSelf = 'auto' | 'flex-start' | 'flex-end' | 'center' | 'baseline' | 'stretch';

	type Props = {
		children: Snippet;
		dir?: FlexDir;
		wrap?: FlexWrap;
		ai?: AlignItems;
		jc?: JustifyContent;
		ac?: AlignContent;
		gap?: number;
		// 逐个子元素的 align-self
		as?: AlignSelf[];
		// 逐个子元素的 flex-grow
		fg?: number[];
		// 逐个子元素的 flex-shrink
		fs?: number[];
		// 逐个子元素的 order
		order?: number[];
		className?: string;
		// 额外透传到根元素的 style 字符串
		style?: string;
	};

	let {
		children,
		dir,
		wrap,
		ai,
		jc,
		ac,
		gap,
		as: alignSelf,
		fg,
		fs,
		order,
		className,
		style
	}: Props = $props();

	// 逐子元素的微调写成根元素上的 CSS 变量, 由 childLayout.css 的 :nth-child 规则消费.
	// 只有数组里真正给值的位置才产生变量, 未给的位置走 CSS 默认值.
	const childVars = $derived(
		toChildVars([
			{ suffix: 'as', values: alignSelf },
			{ suffix: 'grow', values: fg },
			{ suffix: 'shrink', values: fs },
			{ suffix: 'order', values: order }
		])
	);

	// 布局变量 + 逐子元素变量 + 调用方透传的 style, 后者优先
	const boxStyle = $derived(
		[
			dir && `--dir: ${dir}`,
			wrap && `--wrap: ${wrap}`,
			ai && `--align: ${ai}`,
			jc && `--justify: ${jc}`,
			ac && `--ac: ${ac}`,
			gap !== undefined && `--gap: ${gap}`,
			...Object.entries(childVars).map(([name, value]) => `${name}: ${value}`),
			style
		]
			.filter(Boolean)
			.join('; ')
	);
</script>

<div
	class="flex-box {className}"
	style={boxStyle}
	data-child-as={alignSelf ? '' : undefined}
	data-child-grow={fg ? '' : undefined}
	data-child-shrink={fs ? '' : undefined}
	data-child-order={order ? '' : undefined}
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
