<script lang="ts">
    import type { Snippet } from "svelte";

    type Props = {
        children: Snippet;
        [key: string]: any;
    };

    let { children, ...rest }: Props = $props();

    let containerEl: HTMLElement | undefined;
    let destroyed = false;
    // 用随机 key 数组让 {#each} 渲染 N 个 slide
    let slideKeys = $state<(number)[]>([]);

    $effect(() => {
        if (!containerEl) return;

        // 加载 swiper 组件
        const script = document.createElement("script");
        script.src = "https://unpkg.com/swiper/swiper-element-bundle.min.js";
        script.async = true;
        document.head.appendChild(script);

        let swiper: any;
        let slideChangeHandler: (() => void) | undefined;
        let autoplayController: (() => void) | undefined;
        let allVideos: HTMLVideoElement[] = [];
        destroyed = false;

        const initSwiper = () => {
            if (destroyed || !containerEl) return;
            swiper = (containerEl as any).swiper;
            if (!swiper) return;

            autoplayController = () => checkVideoStatus(swiper);
            allVideos = swiper.slides.flatMap(
                (slide: HTMLElement) => Array.from(slide.querySelectorAll("video"))
            );
            allVideos.forEach((v: HTMLVideoElement) => {
                ["play", "pause", "ended", "canplay", "canplaythrough"].forEach(evt =>
                    v.addEventListener(evt, autoplayController!)
                );
            });

            slideChangeHandler = () => {
                checkVideoStatus(swiper);
                pauseInvisible(swiper);
            };
            swiper.on("transitionEnd", slideChangeHandler);
            swiper.on("slideChange", slideChangeHandler);
            slideChangeHandler();
        };

        customElements.whenDefined("swiper-container").then(initSwiper);

        // 设置 attributes
        Object.entries(rest).forEach(([k, v]) => containerEl?.setAttribute(k, String(v)));

        return () => {
            destroyed = true;
            allVideos.forEach((v: HTMLVideoElement) => {
                ["play", "pause", "ended", "canplay", "canplaythrough"].forEach(evt =>
                    v.removeEventListener(evt, autoplayController!)
                );
            });
            if (swiper) {
                swiper.off("transitionEnd", slideChangeHandler);
                swiper.off("slideChange", slideChangeHandler);
            }
        };
    });

    const checkVideoStatus = (sw: any) => {
        if (!sw?.params.autoplay?.enabled) return;
        const visibleVids: HTMLVideoElement[] = sw.slides
            .filter((s: HTMLElement) => s.classList.contains("swiper-slide-visible"))
            .flatMap((s: HTMLElement) => Array.from(s.querySelectorAll("video")));
        const anyPlaying = visibleVids.some((v: HTMLVideoElement) => !v.paused && !v.ended);
        if (anyPlaying) { if (sw.autoplay.running) sw.autoplay.stop(); return; }
        if (!sw.autoplay.running) sw.autoplay.start();
    };

    const pauseInvisible = (sw: any) => {
        sw?.slides?.forEach((slide: HTMLElement) => {
            if (slide.classList.contains("swiper-slide-visible")) return;
            slide.querySelectorAll("video").forEach((v: HTMLVideoElement) => { if (!v.paused) v.pause(); });
        });
    };
</script>

<swiper-container class="swiper" bind:this={containerEl}>
    {#each slideKeys as key}
        <swiper-slide>{@render children()}</swiper-slide>
    {/each}
</swiper-container>

<style>
    .swiper { display: block; max-width: 100vw; }
</style>
