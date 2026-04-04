<script>
    import Swiper from "../../swiper/Swiper.svelte";
</script>

<Swiper>
    {#snippet children()}
        <swiper-slide data-testid="slide-a">A</swiper-slide>
    {/snippet}
</Swiper>
