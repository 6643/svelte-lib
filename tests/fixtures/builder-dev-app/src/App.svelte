<script lang="ts">
    import { state } from "./state.svelte.ts";
</script>

<h1>{state.value}</h1>

<style>
    h1 {
        color: red;
    }
</style>
