<script lang="ts">
	import TextField from './input/TextField.svelte';
	import NumberField from './input/NumberField.svelte';
	import RangeField from './input/RangeField.svelte';
	import CheckField from './input/CheckField.svelte';
	import CaptchaField from './input/CaptchaField.svelte';
	import type { InputProps } from './inputTypes.ts';

	// 三种绑定值共用一套 $bindable: 由 mode 决定实际用哪个
	let {
		value = $bindable(),
		checked = $bindable(),
		group = $bindable(),
		...props
	}: InputProps = $props();

	// 联合类型按 mode 收窄: 每个分支拿到自己的完整 props, 模板里不再出现类型断言
	const rangeProps = $derived(props.mode === 'range' ? props : undefined);
	const textProps = $derived(
		props.mode === 'text' || props.mode === 'password' || props.mode === 'email' || props.mode === 'tel'
			? props
			: undefined
	);
	const textAreaProps = $derived(props.mode === 'textarea' ? props : undefined);
	const numberProps = $derived(props.mode === 'number' ? props : undefined);
	const checkProps = $derived(props.mode === 'checkbox' ? props : undefined);
	const radioProps = $derived(props.mode === 'radio' ? props : undefined);
	const captchaProps = $derived(props.mode === 'captcha' ? props : undefined);

	// 绑定值统一成子组件需要的类型, 未绑定时给该形态的合理初值.
	const stringValue = $derived(typeof value === 'string' ? value : String(value ?? ''));
	const numericValue = $derived(typeof value === 'number' ? value : 0);
</script>

{#if rangeProps}
	<RangeField
		label={rangeProps.label}
		bind:value={() => numericValue, (next) => (value = next)}
		min={rangeProps.min}
		max={rangeProps.max}
		step={rangeProps.step}
		unit={rangeProps.unit}
		left={rangeProps.left}
		right={rangeProps.right}
	/>
{:else if numberProps}
	<NumberField
		label={numberProps.label}
		bind:value={() => numericValue, (next) => (value = next)}
		readonly={numberProps.readonly}
		min={numberProps.min}
		max={numberProps.max}
		step={numberProps.step}
		validate={numberProps.validate}
	/>
{:else if checkProps}
	<CheckField kind="checkbox" label={checkProps.label} bind:checked disabled={checkProps.disabled} />
{:else if radioProps}
	<CheckField
		kind="radio"
		label={radioProps.label}
		value={stringValue}
		bind:group
		disabled={radioProps.disabled}
		name={radioProps.name}
	/>
{:else if captchaProps}
	<CaptchaField
		label={captchaProps.label}
		bind:value={() => stringValue, (next) => (value = next)}
		length={captchaProps.length}
		disabled={captchaProps.disabled}
		pattern={captchaProps.pattern}
	/>
{:else if textAreaProps}
	<TextField
		mode="textarea"
		label={textAreaProps.label}
		bind:value={() => stringValue, (next) => (value = next)}
		readonly={textAreaProps.readonly}
		minLen={textAreaProps.minLen}
		maxLen={textAreaProps.maxLen}
		validate={textAreaProps.validate}
		row={textAreaProps.row}
	/>
{:else if textProps}
	<TextField
		mode={textProps.mode}
		label={textProps.label}
		bind:value={() => stringValue, (next) => (value = next)}
		readonly={textProps.readonly}
		minLen={textProps.minLen}
		maxLen={textProps.maxLen}
		left={textProps.left}
		rightSlot={textProps.right}
		validate={textProps.validate}
		pattern={textProps.mode === 'tel' ? textProps.pattern : undefined}
	/>
{/if}
