<script lang="ts">
	type Props = {
		duration?: number;
		height?: number;
		// 图片地址, 组件内部复制一份做无缝滚动
		imgs: string[];
	};

	let { duration, height, imgs }: Props = $props();
</script>

<div class="image-player" style:--duration={duration} style:--height={height}>
	<div>
		{#each imgs as src, i (i)}
			<img {src} alt="" />
		{/each}
	</div>
	<div>
		{#each imgs as src, i (i)}
			<img {src} alt="" />
		{/each}
	</div>
</div>

<style>
	.image-player {
		position: relative;
		mask-image: linear-gradient(90deg, transparent, white 10%, white 90%, transparent);
		margin: 4px 0;
		display: flex;
		flex-wrap: nowrap;
	}

	/* 无限跑马灯: 没有起止与状态, 保留 CSS keyframes (JS 版等于每帧空转) */
	.image-player > div {
		height: calc(1px * var(--height, 240));
		animation-duration: calc(1s * var(--duration, 32));
		animation-name: moveLeft;
		animation-iteration-count: infinite;
		animation-timing-function: linear;
	}

	.image-player > div > img {
		height: 100%;
	}

	@keyframes moveLeft {
		to {
			transform: translateX(-100%);
		}
	}
</style>
