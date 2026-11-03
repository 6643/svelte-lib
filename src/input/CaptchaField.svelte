<script lang="ts">
	import Field from '../Field.svelte';
	import Button from '../Button.svelte';
	import { icon_content_paste } from '../svgicons.ts';
	import { applyCaptchaInput, filterCaptchaText } from './captcha.ts';

	type Props = {
		label: string;
		// 当前值, 可 `bind:value`
		value?: string;
		// 位数上限, 缺省 6
		length?: number;
		disabled?: boolean;
		// 允许的字符, 缺省 `\w`
		pattern?: RegExp;
	};

	let { value = $bindable(''), label, length, disabled, pattern }: Props = $props();

	const DEFAULT_MATCHER = /^\w$/;

	const limit = $derived(length ?? 6);
	const matcher = $derived(pattern ?? DEFAULT_MATCHER);

	const handleInput = (event: Event) => {
		const input = event.currentTarget as HTMLInputElement;

		// 决策在纯函数里, 组件只负责把结果写回 DOM 与绑定值
		const result = applyCaptchaInput({
			current: value,
			text: input.value,
			event: event as InputEvent,
			matcher,
			limit
		});

		// 未变化时也要恢复输入框: 浏览器可能已经塞进了被拒的字符
		input.value = result.value;
		if (!result.changed) return;

		value = result.value;
		input.setSelectionRange(result.value.length, result.value.length);
	};

	const pasteFromClipboard = async () => {
		const text = await navigator.clipboard.readText();
		value = filterCaptchaText(text, { matcher, limit });
	};
</script>

<Field {label} value={value} right={actions}>
	<input
		class="captcha-input"
		type="text"
		inputmode="numeric"
		maxlength={limit}
		value={value}
		{disabled}
		autocomplete="one-time-code"
		spellcheck={false}
		style:--len={limit}
		oninput={handleInput}
	/>
</Field>

{#snippet actions()}
	<Button
		mode="icon"
		icon={icon_content_paste}
		onclick={pasteFromClipboard}
		disabled={disabled}
		ariaLabel="Paste captcha"
	/>
{/snippet}

<style>
	.captcha-input {
		letter-spacing: 4px;
		appearance: none;
		outline: none;
		font-family: monospace;
		font-style: italic;
		color: var(--raised-fg);
		transition: border-color 160ms ease;
	}

	.captcha-input:focus {
		border-color: var(--accent-color);
	}

	.captcha-input:disabled {
		color: var(--disabled-color);
		border-color: var(--disabled-color);
		cursor: not-allowed;
	}
</style>
