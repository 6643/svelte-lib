<script lang="ts">
    import type { Snippet } from "svelte";

    import { ensureSwiperBundleLoaded } from "./Swiper.bundle-loader.ts";
    import { syncSwiperVideoAutoplay } from "./Swiper.video-autoplay.ts";

    type Props = {
        autoHeight?: boolean;
        autoplayDelay?: number;
        initialSlide?: number;
        loop?: boolean;
        paginationType?: string;
        spaceBetween?: number;
        slidesPerView?: number;
        style?: string;
        watchSlidesProgress?: boolean;
        children?: Snippet;
    };

    let {
        autoHeight = false,
        autoplayDelay,
        initialSlide = 0,
        loop = false,
        paginationType,
        spaceBetween = 0,
        slidesPerView = 1,
        style = "",
        watchSlidesProgress = false,
        children,
    }: Props = $props();

    type SwiperRuntime = {
        autoplay?: { start?: () => void; stop?: () => void };
        off?: (event: string, handler: () => void) => void;
        on?: (event: string, handler: () => void) => void;
        params?: { autoplay?: { enabled?: boolean } };
        slides: Array<{
            classList: { contains: (name: string) => boolean };
            querySelectorAll: (
                selector: string,
            ) => ArrayLike<HTMLVideoElement> | Iterable<HTMLVideoElement>;
        }>;
    };

    type SwiperElement = HTMLElement & {
        swiper?: SwiperRuntime;
    };

    let swiperEl = $state<SwiperElement | undefined>(undefined);

    const syncAttributes = () => {
        const element = swiperEl;
        if (!element) return;

        const attributes: Array<[string, string | undefined]> = [
            ["auto-height", autoHeight ? "true" : undefined],
            [
                "autoplay-delay",
                autoplayDelay ? String(autoplayDelay) : undefined,
            ],
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

    const updateAutoplay = (swiper: SwiperRuntime) =>
        syncSwiperVideoAutoplay(swiper);

    $effect(() => {
        syncAttributes();
    });

    $effect(() => {
        const element = swiperEl;
        if (!element) return;

        let cleanup = () => {};
        let destroyed = false;

        void (async () => {
            try {
                await ensureSwiperBundleLoaded(window, document);
                if (destroyed || element !== swiperEl) return;

                syncAttributes();
                await window.customElements.whenDefined("swiper-container");
                if (destroyed || element !== swiperEl) return;

                const swiper = element.swiper;
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
