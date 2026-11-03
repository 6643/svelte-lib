<script lang="ts">
	import DigitRow from './DigitRow.svelte';
	import Button from './Button.svelte';
	import { icon_add, icon_remove } from './svgicons.ts';
	import { DIGITS } from './utils/digits.ts';

	type Props = {
		// 当前值, 可 `bind:value`
		value?: number;
		min?: number;
		max?: number;
	};

	let { value = $bindable(1), min, max }: Props = $props();

	let direction = $state(1);

	// 负数单独渲染一个减号, 数字位只取绝对值
	const negative = $derived(value < 0);
	const digits = $derived([...String(Math.abs(value))].map(Number));

	const increment = () => {
		if (max !== undefined && value >= max) return;
		direction = 1;
		value = value + 1;
	};

	const decrement = () => {
		if (min !== undefined && value <= min) return;
		direction = -1;
		value = value - 1;
	};
</script>

<div class="counter">
	<Button mode="icon" onclick={decrement} icon={icon_remove} ariaLabel="Decrease" />
	{#if negative}
		<span class="sign">-</span>
	{/if}
	<DigitRow values={DIGITS} {digits} {direction} />
	<Button mode="icon" onclick={increment} icon={icon_add} ariaLabel="Increase" />
</div>

<style>
	.counter {
		display: flex;
		align-items: center;
		gap: 0;
		height: 40px;
		padding: 4px;
	}

	.sign {
		/* 与源实现一致: 负号只占位, 颜色继承行内文字色 */
		user-select: none;
	}
</style>
