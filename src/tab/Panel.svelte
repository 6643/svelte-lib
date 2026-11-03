<script lang="ts">
	import type { Snippet } from 'svelte';
	import { roundCss } from '../utils/round.ts';
	import type { TabDirection } from '../tabTypes.ts';

	type Props = {
		// single: 一次只渲染当前项; list: 全部渲染 (nav 模式靠滚动联动)
		kind: 'single' | 'list';
		// 面板总数; list 时用来逐项渲染
		count: number;
		activeIndex: number;
		// 入场位移方向; single 时生效
		direction?: TabDirection;
		// 入场进度 0 -> 1, 由补间写入
		progress?: number;
		panel: Snippet<[number]>;
		// 滚动位置记忆附件; 由 `useKeepScroll` 产出
		keepScroll?: (el: HTMLElement) => (() => void) | void;
		// list 模式的滚动回调
		onscroll?: (event: Event) => void;
		// 供父组件量测 / 滚动定位
		element?: HTMLElement | undefined;
	};

	let {
		kind,
		count,
		activeIndex,
		direction,
		progress,
		panel,
		keepScroll,
		onscroll,
		element = $bindable()
	}: Props = $props();
</script>

{#if kind === 'single'}
	{#key activeIndex}
		<main
			bind:this={element}
			class="panel"
			{@attach keepScroll}
			data-direction={direction}
			style:--progress={progress === undefined ? undefined : roundCss(progress)}
		>
			{@render panel(activeIndex)}
		</main>
	{/key}
{:else}
	<main bind:this={element} class="panel" {@attach keepScroll} {onscroll}>
		{#each Array.from({ length: count }, (_, index) => index) as index (index)}
			<div data-panel={index}>{@render panel(index)}</div>
		{/each}
	</main>
{/if}

<style>
	.panel {
		width: 100%;
		height: 100%;
		overflow-x: hidden;
		overflow-y: auto;
		/* --progress: 0 -> 1 的入场进度, 由 JS 补间写入 */
		opacity: var(--progress, 1);
	}

	/* 位移方向: 横排左右, 竖排上下; 进度满时位移归零 */
	.panel[data-direction='left'] {
		transform: translateX(calc((var(--progress, 1) - 1) * 100%));
	}

	.panel[data-direction='right'] {
		transform: translateX(calc((1 - var(--progress, 1)) * 100%));
	}

	.panel[data-direction='up'] {
		transform: translateY(calc((1 - var(--progress, 1)) * 100%));
	}

	.panel[data-direction='down'] {
		transform: translateY(calc((var(--progress, 1) - 1) * 100%));
	}
</style>
