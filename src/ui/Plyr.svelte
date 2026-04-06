<script lang="ts">
    type Props = {
        src?: string;
    };

    let { src = "" }: Props = $props();

    const togglePlay = (event: MouseEvent & { currentTarget: EventTarget & HTMLVideoElement }) => {
        const videoEl = event.currentTarget;
        if (videoEl.paused) {
            void videoEl.play();
            return;
        }

        videoEl.pause();
    };
</script>

<video autoplay controls playsinline src={src} onclick={togglePlay}>
    <track kind="captions" />
</video>

<style>
    video {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: contain;
    }
</style>
