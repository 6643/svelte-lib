<script lang="ts">
	import Field from '../Field.svelte';
	import Button from '../Button.svelte';
	import { icon_add, icon_remove } from '../svgicons.ts';
	import type { Validate } from '../inputTypes.ts';

	type Props = {
		label: string;
		// 当前值, 可 `bind:value`
		value?: number;
		readonly?: boolean;
		min?: number;
		max?: number;
		step?: number;
		validate?: Validate;
	};

	let {
		value = $bindable(0),
		label,
		readonly,
		min,
		max,
		step,
		validate
	}: Props = $props();

	const stepSize = $derived(step ?? 1);

	// 夹紧到 [min, max], 未给出边界则不限制.
	const clamp = (next: number): number => {
		if (min !== undefined && next < min) return min;
		if (max !== undefined && next > max) return max;
		return next;
	};

	const increment = () => {
		if (readonly) return;
		value = clamp(value + stepSize);
	};

	const decrement = () => {
		if (readonly) return;
		value = clamp(value - stepSize);
	};
</script>

<Field {label} value={String(value)} {validate} right={actions}>
	<input
		type="number"
		bind:value
		{min}
		{max}
		{step}
		placeholder=" "
		spellcheck={false}
		{readonly}
	/>
</Field>

{#snippet actions()}
	<Button mode="icon" icon={icon_remove} onclick={decrement} disabled={readonly} ariaLabel="Decrease" />
	<Button mode="icon" icon={icon_add} onclick={increment} disabled={readonly} ariaLabel="Increase" />
{/snippet}
