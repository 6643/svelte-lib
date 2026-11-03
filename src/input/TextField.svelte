<script lang="ts">
	import type { Snippet } from 'svelte';
	import Field from '../Field.svelte';
	import type { Validate } from '../inputTypes.ts';

	type Props = {
		// text / password / email / tel / textarea 共用一套外壳, 由 mode 决定控件
		mode: 'text' | 'password' | 'email' | 'tel' | 'textarea';
		label: string;
		value?: string;
		readonly?: boolean;
		minLen?: number;
		maxLen?: number;
		left?: Snippet;
		// 输入框右侧的附加控件 (由调用方渲染, 透传给 Field)
		rightSlot?: Snippet;
		validate?: Validate;
		// 仅 tel 生效
		pattern?: string;
		// 仅 textarea 生效, 缺省 5
		row?: number;
	};

	let {
		mode,
		label,
		value = $bindable(''),
		readonly,
		minLen,
		maxLen,
		left,
		rightSlot,
		validate,
		pattern,
		row
	}: Props = $props();

	const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

	// email 形态自带默认校验; 调用方显式给 validate 时以调用方为准.
	const emailValidate = (text: string): string | undefined =>
		text && !EMAIL_PATTERN.test(text) ? '邮箱格式不正确' : undefined;

	const effectiveValidate = $derived(validate ?? (mode === 'email' ? emailValidate : undefined));

	const inputType = $derived(
		mode === 'password' ? 'password' : mode === 'email' ? 'email' : mode === 'tel' ? 'tel' : 'text'
	);

	// 源实现里只有 TextInput 显式给了 inputmode="text"
	const inputmode = $derived(mode === 'text' ? 'text' : undefined);
	const text = $derived(typeof value === 'string' ? value : String(value ?? ''));
</script>

<Field {label} value={text} validate={effectiveValidate} {left} right={rightSlot}>
	{#if mode === 'textarea'}
		<textarea
			class="plain-textarea"
			inputmode="text"
			rows={row ?? 5}
			bind:value={() => text, (next) => (value = next)}
			placeholder=" "
			spellcheck={false}
			{readonly}
			minlength={minLen}
			maxlength={maxLen}
		></textarea>
	{:else}
		<input
			type={inputType}
			{inputmode}
			pattern={mode === 'tel' ? pattern : undefined}
			bind:value={() => text, (next) => (value = next)}
			placeholder=" "
			spellcheck={false}
			{readonly}
			minlength={minLen}
			maxlength={maxLen}
		/>
	{/if}
</Field>

<style>
	.plain-textarea {
		flex: 1;
		min-width: 0;
		display: block;
		font-size: inherit;
		font-family: inherit;
		line-height: 1.5;
		padding: 11px 8px;
		resize: vertical;
		box-sizing: border-box;
	}
</style>
