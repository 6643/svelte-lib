<script lang="ts">
	import SvgIcon from './SvgIcon.svelte';
	import type { ButtonProps } from './buttonTypes.ts';

	let {
		mode,
		onclick,
		disabled,
		color,
		icon,
		text,
		bgColor,
		borderRadius,
		width,
		height,
		ariaLabel,
		ariaExpanded,
		ariaControls,
		children
	}: ButtonProps = $props();

	let busy = $state(false);
	let buttonEl = $state<HTMLButtonElement>();

	const toCssSize = (value: number | string | undefined): string | undefined =>
		typeof value === 'number' ? `${value}px` : value;

	const radius = $derived(toCssSize(borderRadius));
	const cssHeight = $derived(toCssSize(height));
	const cssWidth = $derived(toCssSize(width));

	const isPromiseLike = (value: unknown): value is PromiseLike<unknown> =>
		!!value &&
		(typeof value === 'object' || typeof value === 'function') &&
		typeof (value as PromiseLike<unknown>).then === 'function';

	const handleClick = async (event: MouseEvent) => {
		if (busy) return;
		busy = true;
		try {
			const result = onclick?.(event);
			if (isPromiseLike(result)) await result;
		} finally {
			busy = false;
		}

		// 与源实现一致: 点击后把同组输入框的焦点还回去
		const target = buttonEl?.closest('.input-wrap')?.querySelector('input, textarea');
		if (target instanceof HTMLElement) target.focus();
	};
</script>

<button
	bind:this={buttonEl}
	type="button"
	class={mode}
	disabled={disabled || busy}
	style:--color={color}
	style:--bg={bgColor}
	style:--radius={radius}
	style:--height={cssHeight}
	style:--width={cssWidth}
	aria-label={ariaLabel}
	aria-expanded={ariaExpanded}
	aria-controls={ariaControls}
	onclick={handleClick}
	onmousedown={(event) => event.preventDefault()}
>
	{#if icon}<SvgIcon svgPaths={icon} />{/if}
	{#if children}
		{@render children()}
	{:else if text}
		<span>{text}</span>
	{/if}
</button>

<style>
	button {
		appearance: none;
		border: 0;
		border-radius: var(--radius, 3px);
		box-sizing: border-box;
		cursor: pointer;
		align-items: center;
		display: inline-flex;
		font: inherit;
		gap: 8px;
		justify-content: center;
		min-height: 40px;
		min-width: 40px;
		overflow: hidden;
		position: relative;
		user-select: none;
		vertical-align: middle;
		transition-duration: 512ms;
	}

	/* 按下时的水波: 纯伪元素反馈, pointerdown 就要即时响应, 没有结束语义 */
	button::before {
		content: '';
		width: 200%;
		height: auto;
		aspect-ratio: 1;
		position: absolute;
		top: 50%;
		left: 50%;
		border-radius: 50%;
		background: currentColor;
		pointer-events: none;
		transform: translate(-50%, -50%) scale(1);
		opacity: 0;
		transition:
			transform 512ms ease,
			opacity 512ms ease;
	}

	button:active::before {
		transform: translate(-50%, -50%) scale(0);
		opacity: 0.28;
		transition: none;
	}

	/* 焦点呼吸灯: 无状态的无限循环, 没有状态可驱动, 用 JS 每帧改写只会白占主线程 */
	@keyframes breathe {
		0%,
		100% {
			box-shadow: inset 0 0 0 2px var(--accent-color);
		}
		50% {
			box-shadow: inset 0 0 6px 2px var(--accent-color);
		}
	}

	button:focus-visible {
		animation: breathe 2s ease-in-out infinite;
	}

	button:disabled {
		box-shadow: none;
		cursor: not-allowed;
		pointer-events: none;
		color: var(--disabled-color);
	}

	.icon {
		background: transparent;
		border-radius: 40px;
		height: 40px;
		width: 40px;
		color: var(--color, var(--accent-color, var(--raised-fg)));
	}

	.text {
		background: transparent;
		box-shadow: none;
		color: var(--color, var(--accent-color, var(--raised-fg)));
		padding: 0 16px;
	}

	.filled {
		color: white;
		background-color: var(--bg, var(--accent-color));
		height: var(--height);
		width: var(--width);
		padding: 0 16px;
	}

	.filled:disabled {
		background-color: var(--inset-bg);
	}

	.outlined {
		color: var(--color, var(--accent-color, var(--raised-fg)));
		background: transparent;
		border: 2px solid var(--color, var(--accent-color));
		box-shadow: none;
		height: var(--height);
		width: var(--width);
		padding: 0 16px;
	}

	.outlined:disabled {
		border-color: var(--disabled-color);
	}
</style>
