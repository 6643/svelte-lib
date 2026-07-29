<script lang="ts">
    type Props = {
        /** 动画时长（秒），默认 32 */
        duration?: number;
        /** 高度，默认 240 */
        height?: number;
        /** 图片 URL 列表 */
        children: string[];
    };

    let { duration, height, children }: Props = $props();
</script>

<div class="image-player" style:--duration={duration} style:--height={height}>
    <div>
        {#each children as src}
            <img {src} alt="" />
        {/each}
    </div>
    <div>
        {#each children as src}
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
