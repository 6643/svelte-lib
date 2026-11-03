<script lang="ts">
	import { createTween } from './hooks/createTween.svelte.ts';

	type Props = {
		imgs: string[];
		// 当前索引, 可 `bind:index`
		index?: number;
		className?: string;
	};

	let { imgs, index = $bindable(0), className }: Props = $props();

	// 位移由 Tween 补间, CSS 只负责布局
	const offset = createTween(() => index * 100, { duration: 240 });

	// 图片减少时把越界索引收回
	$effect(() => {
		const len = imgs.length;
		if (len <= 0) {
			index = 0;
			return;
		}
		if (index >= len) index = len - 1;
	});

	const go = (next: number) => {
		const len = imgs.length;
		if (len <= 0) return;

		index = ((next % len) + len) % len;
	};
</script>

<div class="carousel {className}">
	<div class="inner" style:transform={`translateX(-${offset.current}%)`}>
		{#each imgs as src, i (i)}
			<div class="item">
				<img {src} alt="Carousel image {i + 1}" />
			</div>
		{/each}
	</div>
	<button type="button" class="prev" aria-label="Previous" onclick={() => go(index - 1)}>
		‹
	</button>
	<button type="button" class="next" aria-label="Next" onclick={() => go(index + 1)}>
		›
	</button>
</div>

<style>
	.carousel {
		overflow: hidden;
		position: relative;
		width: 100%;
	}

	.inner {
		display: flex;
		will-change: transform;
	}

	.item {
		flex: 0 0 100%;
		min-width: 100%;
	}

	.item img {
		width: 100%;
		display: block;
	}

	.prev,
	.next {
		position: absolute;
		top: 50%;
		transform: translateY(-50%);
		border: 0;
		background: color-mix(in srgb, var(--base-bg) 80%, transparent);
		color: var(--base-fg);
		width: 2rem;
		height: 2rem;
		border-radius: 999px;
		cursor: pointer;
	}

	.prev {
		left: 0.5rem;
	}

	.next {
		right: 0.5rem;
	}
</style>
