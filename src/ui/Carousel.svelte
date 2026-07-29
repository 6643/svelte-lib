<script lang="ts">
    type Props = {
        imgs: string[];
        index?: number;
        changed?: (index: number) => void;
        class?: string;
    };

    let { imgs, index: externalIndex, changed, class: className }: Props = $props();

    let currentIndex = $state(externalIndex ?? 0);

    $effect(() => {
        const idx = externalIndex;
        if (idx !== undefined) currentIndex = idx;
    });

    $effect(() => {
        const len = imgs.length;
        if (len <= 0) { currentIndex = 0; return; }
        if (currentIndex >= len) currentIndex = len - 1;
    });

    const go = (next: number) => {
        const len = imgs.length;
        if (len <= 0) return;
        const clamped = ((next % len) + len) % len;
        currentIndex = clamped;
        changed?.(clamped);
    };
</script>

<div class="carousel {className ?? ''}">
    <div class="inner" style="transform: translateX(-{currentIndex * 100}%)">
        {#each imgs as imgSrc, i}
            <div class="item">
                <img src={imgSrc} alt="Carousel image {i + 1}" />
            </div>
        {/each}
    </div>
    <button type="button" class="prev" aria-label="上一张" onclick={() => go(currentIndex - 1)}>
        ‹
    </button>
    <button type="button" class="next" aria-label="下一张" onclick={() => go(currentIndex + 1)}>
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
        transition: transform 240ms ease;
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
