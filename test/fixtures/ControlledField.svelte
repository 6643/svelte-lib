<script lang="ts">
	import { untrack } from 'svelte';
	import Input from '../../src/Input.svelte';
	import type { Validate } from '../../src/inputTypes.ts';

	// 受控用法: 上层持有 value, 用 bind:value 双向绑定.
	// 值同时渲染到 .value 上, 便于断言回写.
	type Props = {
		component: 'text' | 'email' | 'captcha' | 'number' | 'textarea' | 'range' | 'checkbox' | 'radio';
		label: string;
		initial?: string;
		length?: number;
		min?: number;
		max?: number;
		validate?: Validate;
		onChanged?: (value: string) => void;
	};

	let { component, label, initial = '', length, min, max, validate, onChanged }: Props = $props();

	let value = $state(untrack(() => initial));
	let numberValue = $state(Number(untrack(() => initial) || 0));
	let checkedValue = $state(false);
	let groupValue = $state('');
	let seen = untrack(() => initial);

	// 只在值真正变化时通知, 模拟外部订阅者
	$effect(() => {
		const next =
			component === 'number' || component === 'range'
				? String(numberValue)
				: component === 'checkbox'
					? String(checkedValue)
					: component === 'radio'
						? groupValue
						: value;
		if (next === seen) return;
		seen = next;
		onChanged?.(next);
	});
</script>

{#if component === 'text'}
	<Input mode="text" {label} {validate} bind:value />
{:else if component === 'email'}
	<Input mode="email" {label} bind:value />
{:else if component === 'captcha'}
	<Input mode="captcha" {label} {length} bind:value />
{:else if component === 'textarea'}
	<Input mode="textarea" {label} row={3} bind:value />
{:else if component === 'checkbox'}
	<Input mode="checkbox" {label} bind:checked={checkedValue} />
{:else if component === 'radio'}
	<Input mode="radio" {label} value="male" name="gender" bind:group={groupValue} />
{:else if component === 'range'}
	<Input mode="range" {label} {min} {max} unit="%" bind:value={numberValue} />
{:else}
	<Input mode="number" {label} {min} {max} bind:value={numberValue} />
{/if}

<output class="value">
	{component === 'number' || component === 'range'
		? numberValue
		: component === 'checkbox'
			? checkedValue
			: component === 'radio'
				? groupValue
				: value}
</output>
