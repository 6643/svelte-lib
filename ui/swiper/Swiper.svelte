<script>
    import { onMount } from "svelte";

    import { ensureSwiperBundleLoaded } from "./swiper-bundle-loader.ts";
    import { syncSwiperVideoAutoplay } from "./video-autoplay.ts";

    export let autoHeight = false;
    export let autoplayDelay = undefined;
    export let initialSlide = 0;
    export let loop = false;
    export let paginationType = undefined;
    export let spaceBetween = 0;
    export let slidesPerView = 1;
    export let style = "";
    export let watchSlidesProgress = false;

    let swiperEl;

    const syncAttributes = () => {
        if (!swiperEl) return;

        const attributes = [
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
                swiperEl.removeAttribute(name);
                return;
            }

            swiperEl.setAttribute(name, value);
        });
    };

    const updateAutoplay = (swiper) => syncSwiperVideoAutoplay(swiper);

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
    <slot />
</swiper-container>

<style>
    .swiper-root {
        width: 100%;
        display: block;
    }
</style>
