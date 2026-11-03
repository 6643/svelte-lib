<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		label: string;
		// 当前值, 可 `bind:value`
		value?: number;
		min?: number;
		max?: number;
		step?: number;
		// 数值后面的单位, 显示在右上角
		unit?: string;
		left?: Snippet;
		right?: Snippet;
	};

	let { value = $bindable(0), label, min, max, step, unit, left, right }: Props = $props();

	// 缺省值由源实现固定: 0..100, 步长 1
	const bounds = $derived({ min: min ?? 0, max: max ?? 100, step: step ?? 1 });
</script>

<label class="range-input">
	<div>
		<span>{label}</span>
		<span data-unit={unit}>{value}</span>
	</div>
	<div>
		{#if left}{@render left()}{/if}
		<input type="range" {...bounds} spellcheck={false} bind:value />
		{#if right}{@render right()}{/if}
	</div>
</label>

<style>
	.range-input {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.range-input > div {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.range-input input[type='range'] {
		width: 100%;
		height: 40px;
		appearance: none;
		background: transparent;
		cursor: pointer;
	}

	.range-input input[type='range']::-webkit-slider-runnable-track {
		height: 4px;
		border-radius: 2px;
		background: var(--inset-bg);
		box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.12);
	}

	.range-input input[type='range']::-moz-range-track {
		height: 4px;
		border-radius: 2px;
		background: var(--inset-bg);
		box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.12);
	}

	.range-input input[type='range']::-webkit-slider-thumb {
		appearance: none;
		width: 10px;
		height: 10px;
		border: none;
		border-radius: 50%;
		background: var(--accent-color);
		margin-top: -3px;
	}

	.range-input input[type='range']::-moz-range-thumb {
		appearance: none;
		width: 10px;
		height: 10px;
		border: none;
		border-radius: 50%;
		background: var(--accent-color);
	}
</style>
