<script lang="ts">
    type Props = {
        src: string;
    };

    let { src }: Props = $props();
    let videoEl: HTMLVideoElement | undefined;

    const togglePlay = () => {
        if (!videoEl) return;
        videoEl.paused ? videoEl.play() : videoEl.pause();
    };

    $effect(() => {
        if (!videoEl) return;
        let destroyed = false;

        // 加载 Plyr
        const script = document.createElement("script");
        script.src = "https://cdn.plyr.io/3.8.3/plyr.js";
        script.async = true;
        document.head.appendChild(script);

        const link = document.createElement("link");
        link.href = "https://cdn.plyr.io/3.8.3/plyr.css";
        link.rel = "stylesheet";
        document.head.appendChild(link);

        script.onload = () => {
            if (destroyed || !videoEl) return;
            const PlyrCtor = (window as any).Plyr;
            if (!PlyrCtor) return;
            const player = new PlyrCtor(videoEl, { controls: ["play", "progress", "volume"] });
            // Svelte 5 cleanup
            return () => { player.destroy(); };
        };

        return () => {
            destroyed = true;
            // 不要移除 script/link，其他实例可能在使用
        };
    });
</script>

<video bind:this={videoEl} {src} onclick={togglePlay} autoplay preload="metadata">
    <track kind="captions" />
</video>
