<script lang="ts">
	import { untrack } from 'svelte';
	import { cubicOut } from 'svelte/easing';
	import { prefersReducedMotion, Tween } from 'svelte/motion';
	import type { ModalProps } from './modalTypes.ts';

	let {
		mode,
		open = $bindable(false),
		onClose,
		width,
		height,
		ariaLabel,
		className,
		children
	}: ModalProps = $props();

	// 进出场时长, 与源码 CSS transition 一致
	const ANIMATION_MS = 256;

	// mounted 控制 dialog 是否在 DOM 里; 进度由 Tween 逐帧推进, 归零即卸挂
	let mounted = $state(false);
	// bind:this 的目标必须是 $state, 否则下面的 effect 读不到元素挂载
	let dialogEl = $state<HTMLDialogElement>();

	// 0 = 收起, 1 = 展开; 位移与透明度都由它派生.
	// 一律从 0 起, 这样 "挂载即 open" 的弹层也会滑入 (而不是突然出现)
	const progress = new Tween(0, { duration: ANIMATION_MS, easing: cubicOut });

	$effect(() => {
		const wanted = open;
		const duration = prefersReducedMotion.current ? 0 : ANIMATION_MS;

		if (wanted) {
			mounted = true;
			void progress.set(1, { duration });
			return;
		}

		void progress.set(0, { duration }).then(() => {
			// 中途又被打开时, 新效果已把 mounted 置回 true
			if (!open) mounted = false;
		});
	});

	// 组件销毁时中止补间: Svelte 的 RAF 队列是模块级的, 留下未完成的任务会拖住后续动画
	$effect(() => () => {
		void progress.set(untrack(() => progress.current), { duration: 0 });
	});

	// dialog 只有在挂载之后才能 showModal; 卸载前先 close, 否则页面会一直 inert
	$effect(() => {
		const el = dialogEl;
		if (!el) return;

		if (mounted && !el.open) el.showModal();
		if (!mounted && el.open) el.close();
	});

	// 关闭. 幂等: 同一个 Escape 会先触发 keydown, 真实浏览器随后还会派发 dialog 的
	// `cancel`, 两条路都会走到这里, 因此必须用 `open` 本身做去重.
	const close = () => {
		if (!open) return;
		open = false;
		onClose?.();
	};

	// 单测环境 (happy-dom) 不实现 dialog 的 Escape -> cancel 派发, 因此 keydown 是主路径;
	// 真实浏览器两条路都会来, 由 close 的幂等守卫合并成一次 onClose.
	const handleKeyDown = (event: KeyboardEvent) => {
		if (event.key !== 'Escape') return;
		event.preventDefault();
		close();
	};

	const handleClick = (event: MouseEvent) => {
		if ((event.target as HTMLElement).closest('.content')) return;
		close();
	};

	// 与源实现一致: top 复用 .center (上下居中), left/right 复用同名内容类, bottom 无附加类
	const contentClass = $derived(
		mode === 'top' ? 'center' : mode === 'bottom' ? undefined : mode,
	);
</script>

{#if mounted}
	<dialog
		bind:this={dialogEl}
		class="modal {mode} {className}"
		style:--progress={progress.current}
		aria-label={ariaLabel}
		onkeydown={handleKeyDown}
		onclick={handleClick}
		oncancel={(event) => {
			event.preventDefault();
			close();
		}}
	>
		<div class="overlay"></div>
		<div
			data-mode={contentClass ?? 'bottom'}
			class="content {contentClass}"
			style:--max-height={height}
			style:--max-width={width}
		>
			{@render children?.()}
		</div>
	</dialog>
{/if}

<style>
	dialog {
		margin: 0;
		padding: 0;
		width: 100vw;
		height: 100vh;
		border: none;
		outline: none;
		background: transparent;
		color: inherit;
		overflow: hidden;
		max-width: 100vw;
		max-height: 100vh;

		/* --progress: 0 收起, 1 展开; 位移与透明度都由 JS 补间后写在这个变量上 */
		opacity: var(--progress, 0);
		will-change: transform, opacity;
	}

	dialog::backdrop {
		background: transparent;
	}

	.overlay {
		position: absolute;
		inset: 0;
		background: rgba(0, 0, 0, calc(0.5 * var(--progress, 0)));
	}

	.content {
		position: absolute;
		bottom: 0;
		left: 0;
		width: 100%;
		height: var(--max-height, 100vh);
		overflow-x: hidden;
		overflow-y: auto;
		background: white;
		z-index: 1;
	}

	.content.center {
		top: 0;
		bottom: 0;
		left: 0;
		right: 0;
		margin: auto;
		width: fit-content;
		height: fit-content;
		min-height: 160px;
		min-width: 320px;
		transform: translateY(calc((var(--progress, 0) - 1) * 100vh));
		will-change: transform;
	}

	.content.left {
		left: 0;
		top: 0;
		width: var(--max-width, 320px);
		height: 100vh;
	}

	.content.right {
		left: auto;
		right: 0;
		top: 0;
		width: var(--max-width, 320px);
		height: 100vh;
	}

	dialog.bottom {
		top: auto;
		bottom: 0;
		transform: translateY(calc((1 - var(--progress, 0)) * 100%));
	}

	dialog.left {
		right: auto;
		left: 0;
		top: 0;
		bottom: 0;
		transform: translateX(calc((var(--progress, 0) - 1) * 100%));
	}

	dialog.right {
		left: auto;
		right: 0;
		top: 0;
		bottom: 0;
		transform: translateX(calc((1 - var(--progress, 0)) * 100%));
	}
</style>
