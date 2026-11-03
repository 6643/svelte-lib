<script lang="ts">
	import type { Snippet } from 'svelte';
	import { toChildPosVars } from './utils/childLayout.ts';
	import './childLayout.css';

	type Pos = { x?: number; y?: number };

	type Props = {
		children: Snippet;
		// 逐个子元素的偏移; x 正数靠左, 负数贴右; y 正数贴顶, 负数贴底
		pos?: Pos[];
	};

	let { children, pos }: Props = $props();

	// 偏移量写成根元素上的 CSS 变量, 由 childLayout.css 的 :nth-child 规则消费
	const boxStyle = $derived(
		Object.entries(toChildPosVars(pos))
			.map(([name, value]) => `${name}: ${value}`)
			.join('; ')
	);
</script>

<div class="stack-box" style={boxStyle} data-child-pos={pos ? '' : undefined}>
	{@render children()}
</div>

<style>
	.stack-box {
		width: 100%;
		height: calc(1px * var(--height, 160));
		background: var(--bg, var(--accent-color));
		display: grid;
		place-items: center;
		position: relative;
	}

	/* 子元素一律脱离文档流 (源实现用 !important, 因为子组件自己的 position 优先级更高);
	   未给 pos 时四边留空, 由 place-items 居中 */
	.stack-box > :global(*) {
		position: absolute !important;
	}
</style>
