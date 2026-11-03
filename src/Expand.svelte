<script lang="ts">
	import { fly } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import SvgIcon from './SvgIcon.svelte';
	import { icon_chevron_right } from './svgicons.ts';
	import type { Snippet } from 'svelte';

	type Props = {
		title: string;
		children?: Snippet;
	};

	let { title, children }: Props = $props();

	let visible = $state(false);

	// 内容进出场由 Svelte 的 fly 负责: 时长/曲线在这里, 不再用定时器等 CSS
	const contentTransition = { x: '100%', duration: 512, easing: cubicOut };
</script>

<div class="expand" class:active={visible}>
	<button type="button" class="head" onclick={() => (visible = !visible)}>
		<span>{title}</span>
		<SvgIcon svgPaths={icon_chevron_right} />
	</button>
	{#if visible}
		<div in:fly={contentTransition} out:fly={contentTransition}>
			{@render children?.()}
		</div>
	{/if}
</div>

<style>
	.expand {
		display: grid;
		grid-template-rows: 48px 1fr;
	}

	.expand > .head {
		appearance: none;
		border: 0;
		font: inherit;
		user-select: none;
		padding: 8px;
		display: flex;
		width: 100%;
		justify-content: space-between;
		align-items: center;
		color: var(--color);
		background-color: var(--inset-bg);
		cursor: pointer;
		transition-duration: 512ms;
	}

	.expand > .head > :last-child {
		transition-duration: 512ms;
	}

	.expand > div {
		padding: 8px;
	}

	.expand.active > .head {
		background-color: var(--accent-color);
		--color: var(--inset-bg);
	}

	.expand.active > .head > :last-child {
		transform: rotate(90deg);
	}

	.expand.active > div {
		background-color: var(--inset-bg);
	}
</style>
