<script>
    import { onMount } from "svelte";

    import { shouldAutoplayRun } from "./video-autoplay.ts";

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

    const ensureSwiperBundle = async () => {
        if (typeof window === "undefined") return;
        if (window.customElements.get("swiper-container")) return;

        await new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = "https://unpkg.com/swiper/swiper-element-bundle.min.js";
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Failed to load Swiper bundle."));
            document.head.appendChild(script);
        });
    };

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

    const pauseInvisibleVideos = (swiper) => {
        swiper?.slides?.forEach((slide) => {
            if (slide.classList.contains("swiper-slide-visible")) return;

            slide.querySelectorAll("video").forEach((videoEl) => {
                if (!(videoEl instanceof HTMLVideoElement) || videoEl.paused) return;
                videoEl.pause();
            });
        });
    };

    const updateAutoplay = (swiper) => {
        if (!swiper?.params?.autoplay?.enabled) return;

        const videos = swiper.slides.flatMap((slide) =>
            Array.from(slide.querySelectorAll("video")).map((videoEl) => ({
                ended: videoEl.ended,
                paused: videoEl.paused,
                visible: slide.classList.contains("swiper-slide-visible"),
            })),
        );

        if (shouldAutoplayRun(videos)) {
            swiper.autoplay?.start?.();
            pauseInvisibleVideos(swiper);
            return;
        }

        swiper.autoplay?.stop?.();
    };

    onMount(() => {
        let cleanup = () => {};

        void (async () => {
            await ensureSwiperBundle();
            syncAttributes();

            await window.customElements.whenDefined("swiper-container");

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
        })();

        return () => cleanup();
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
