<script lang="ts">
	import { untrack } from 'svelte';
	import type { Snippet } from 'svelte';
	import type { Validate } from './inputTypes.ts';

	type Props = {
		label: string;
		// 当前值, 供校验使用
		value?: string;
		validate?: Validate;
		left?: Snippet;
		right?: Snippet;
		children: Snippet;
	};

	let { label, value, validate, left, right, children }: Props = $props();

	let error = $state<string | undefined>(undefined);
	let checking = $state(false);
	const current = $derived(value ?? '');

	// 异步校验的竞态由 effect 的清理函数负责: 值再变一次就作废上一次结果,
	// 不需要额外的序号计数 (序号只是手工模拟 "cancel").
	$effect(() => {
		const next = current;
		const check = validate;

		if (!check) {
			error = undefined;
			checking = false;
			return;
		}

		const result = check(next);

		if (!(result instanceof Promise)) {
			error = result;
			checking = false;
			return;
		}

		let cancelled = false;
		checking = true;

		void result
			.then((message) => {
				if (cancelled) return;
				error = message;
			})
			.finally(() => {
				if (cancelled) return;
				checking = false;
			});

		return () => {
			cancelled = true;
		};
	});

	const message = $derived(checking ? '校验中...' : (error ?? ''));
</script>

<label class="field" class:error={!!error}>
	<div>
		<span>{label}</span>
		<span class="field-error">{message}</span>
	</div>
	<div class="input-wrap">
		{@render left?.()}
		<div class="input-grow">{@render children()}</div>
		{@render right?.()}
	</div>
</label>

<style>
	.field {
		display: flex;
		flex-direction: column;
	}

	.field > div:first-child {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.field .input-wrap {
		display: flex;
		align-items: center;
		gap: 4px;
		width: 100%;
		height: 40px;
		background: var(--base-bg);
		border: 0;
		border-left: 2px solid transparent;
		border-radius: 3px;
		position: relative;
		transition: border-color 160ms ease;
	}

	.field .input-wrap:has(:global(textarea)) {
		height: auto;
		min-height: 40px;
		align-items: stretch;
	}

	.field .input-wrap:has(:global(input:focus), :global(textarea:focus)) {
		border-left-color: var(--accent-color);
		box-shadow: none;
	}

	.field.error .input-wrap {
		border-left-color: var(--error-color);
		box-shadow: none;
	}

	.field .input-grow {
		flex: 1;
		min-width: 0;
	}

	.field :global(input),
	.field :global(textarea) {
		appearance: none;
		background: transparent;
		border: none;
		color: inherit;
		box-shadow: none;
		outline: 0;
	}

	.field .input-grow :global(input),
	.field .input-grow :global(textarea) {
		width: 100%;
		resize: vertical;
	}

	.field .input-grow :global(> input) {
		display: block;
		box-sizing: border-box;
		height: 100%;
		padding: 0 8px;
		line-height: 36px;
	}

	.field :global(input[type='number']) {
		appearance: textfield;
	}

	.field :global(input[type='number']::-webkit-inner-spin-button),
	.field :global(input[type='number']::-webkit-outer-spin-button) {
		appearance: none;
		margin: 0;
	}

	.field :global(input:-webkit-autofill),
	.field :global(textarea:-webkit-autofill) {
		-webkit-box-shadow: 0 0 0 1000px var(--base-bg) inset;
		-webkit-text-fill-color: var(--base-fg);
	}

	.field :global(input::placeholder),
	.field :global(textarea::placeholder) {
		color: var(--disabled-color);
	}

	.field :global(input:disabled),
	.field :global(textarea:disabled) {
		color: var(--disabled-color);
		cursor: not-allowed;
	}

	.field-error {
		color: var(--error-color);
	}
</style>
