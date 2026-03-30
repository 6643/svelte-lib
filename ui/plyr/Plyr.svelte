<script>
    export let src = "";

    const togglePlay = (event) => {
        const videoEl = event.currentTarget;
        if (videoEl.paused) {
            void videoEl.play();
            return;
        }

        videoEl.pause();
    };
</script>

<video autoplay controls playsinline src={src} on:click={togglePlay}>
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
