<script>
    import Swiper from "../../Swiper.svelte";
</script>

<Swiper>
    {#snippet children()}
        <swiper-slide data-testid="slide-a">A</swiper-slide>
    {/snippet}
</Swiper>
