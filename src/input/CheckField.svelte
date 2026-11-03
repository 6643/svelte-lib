<script lang="ts">
	type Props = {
		// checkbox 用 checked, radio 用 value + group
		kind: 'checkbox' | 'radio';
		label: string;
		checked?: boolean;
		value?: string;
		// radio 的当前选中值, 可 `bind:group`
		group?: string;
		disabled?: boolean;
		name?: string;
	};

	// checked / group 都用无缺省值的 $bindable: 调用方没绑定时保持 undefined,
	// 避免 "父级传 undefined 但子级有 fallback" 的 props_invalid_value
	let {
		kind,
		label,
		checked = $bindable(),
		value,
		group = $bindable(),
		disabled,
		name
	}: Props = $props();

	// radio 的选项标识: 组件本身不写 value, 由调用方给
	const radioValue = $derived(String(value ?? ''));
</script>

<label class={kind === 'checkbox' ? 'check-btn' : 'radio-btn'}>
	{#if kind === 'checkbox'}
		<input type="checkbox" bind:checked {disabled} />
	{:else}
		<input type="radio" value={radioValue} bind:group {disabled} {name} />
	{/if}
	<span>{label}</span>
</label>

<style>
	/* 源 CSS 里 CheckButton 与 RadioButton 本就是同一组规则 */
	.check-btn,
	.radio-btn {
		display: inline-flex;
		align-items: center;
		align-self: flex-start;
		gap: 8px;
		cursor: pointer;
		user-select: none;
		padding: 6px 12px;
		border: 2px solid var(--inset-fg);
		border-radius: 3px;
		transition: border-color 160ms ease;
		overflow: hidden;
		position: relative;
	}

	/* 按下时的扩散反馈: 伪元素 + pointer 高频路径, 保留 CSS */
	.check-btn::before,
	.radio-btn::before {
		content: '';
		width: 100%;
		height: 100%;
		position: absolute;
		top: 0;
		left: 0;
		background-image: radial-gradient(circle, currentColor 10%, transparent 10%);
		background-size: 1000% 1000%;
		background-position: 50%;
		pointer-events: none;
		transition: 512ms;
		opacity: 0;
	}

	.check-btn:active::before,
	.radio-btn:active::before {
		background-size: 0 0;
		opacity: 0.28;
		transition: none;
	}

	.check-btn :global(input),
	.radio-btn :global(input) {
		position: absolute;
		opacity: 0;
		width: 0;
		height: 0;
	}

	.check-btn span,
	.radio-btn span {
		color: var(--inset-fg);
		font-size: 14px;
	}

	.check-btn:has(:global(input:checked)),
	.radio-btn:has(:global(input:checked)) {
		border-color: var(--accent-color);
		opacity: 1;
	}

	.check-btn:has(:global(input:checked)) span,
	.radio-btn:has(:global(input:checked)) span {
		color: var(--accent-color);
	}

	.check-btn:has(:global(input:disabled)),
	.radio-btn:has(:global(input:disabled)) {
		border-color: var(--disabled-color);
		cursor: not-allowed;
	}

	.check-btn:has(:global(input:disabled)) span,
	.radio-btn:has(:global(input:disabled)) span {
		color: var(--disabled-color);
	}
</style>
