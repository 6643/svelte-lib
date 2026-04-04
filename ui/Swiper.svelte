<script lang="ts">
    import { onMount } from "svelte";
    import type { Snippet } from "svelte";

    import { ensureSwiperBundleLoaded } from "./Swiper.bundle-loader.ts";
    import { syncSwiperVideoAutoplay } from "./Swiper.video-autoplay.ts";

    export let autoHeight = false;
    export let autoplayDelay = undefined;
    export let initialSlide = 0;
    export let loop = false;
    export let paginationType = undefined;
    export let spaceBetween = 0;
    export let slidesPerView = 1;
    export let style = "";
    export let watchSlidesProgress = false;
    export let children: Snippet | undefined = undefined;

    type SwiperRuntime = {
        autoplay?: { start?: () => void; stop?: () => void };
        off?: (event: string, handler: () => void) => void;
        on?: (event: string, handler: () => void) => void;
        params?: { autoplay?: { enabled?: boolean } };
        slides: Array<{
            classList: { contains: (name: string) => boolean };
            querySelectorAll: (selector: string) => ArrayLike<HTMLVideoElement> | Iterable<HTMLVideoElement>;
        }>;
    };

    type SwiperElement = HTMLElement & {
        swiper?: SwiperRuntime;
    };

    let swiperEl: SwiperElement | undefined = undefined;

    const syncAttributes = () => {
        const element = swiperEl;
        if (!element) return;

        const attributes: Array<[string, string | undefined]> = [
            ["auto-height", autoHeight ? "true" : undefined],
            ["autoplay-delay", autoplayDelay ? String(autoplayDelay) : undefined],
            ["initial-slide", String(initialSlide)],
            ["loop", loop ? "true" : undefined],
            ["pagination-type", paginationType],
            ["space-between", String(spaceBetween)],
            ["slides-per-view", String(slidesPerView)],
            ["style", style || undefined],
            ["watch-slides-progress", watchSlidesProgress ? "true" : undefined],
        ];

        attributes.forEach(([name, value]) => {
            if (value === undefined) {
                element.removeAttribute(name);
                return;
            }

            element.setAttribute(name, value);
        });
    };

    const updateAutoplay = (swiper: SwiperRuntime) => syncSwiperVideoAutoplay(swiper);

    onMount(() => {
        let cleanup = () => {};
        let destroyed = false;

        void (async () => {
            try {
                await ensureSwiperBundleLoaded(window, document);
                if (destroyed || !swiperEl) return;

                syncAttributes();
                await window.customElements.whenDefined("swiper-container");
                if (destroyed || !swiperEl) return;

                const swiper = swiperEl.swiper;
                if (!swiper) return;

                const handleSlideChange = () => updateAutoplay(swiper);

                swiper.on?.("slideChange", handleSlideChange);
                swiper.on?.("transitionEnd", handleSlideChange);
                updateAutoplay(swiper);

                cleanup = () => {
                    swiper.off?.("slideChange", handleSlideChange);
                    swiper.off?.("transitionEnd", handleSlideChange);
                };
            } catch (error) {
                console.error(error);
            }
        })();

        return () => {
            destroyed = true;
            cleanup();
        };
    });

    $: syncAttributes();
</script>

<swiper-container bind:this={swiperEl} class="swiper-root">
    {#if children}
        {@render children()}
    {/if}
</swiper-container>

<style>
    .swiper-root {
        width: 100%;
        display: block;
    }
</style>
