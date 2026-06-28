<script lang="ts">
    import Counter from "./Counter.svelte";
</script>

<main id="app">
    <h1>Demo App</h1>
    <p>This is a demo project using <strong>svelte-builder</strong>.</p>
    <Counter />
</main>

<style>
    :global(body) {
        font-family: system-ui, sans-serif;
        max-width: 640px;
        margin: 0 auto;
        padding: 2rem;
        background: #fafafa;
        color: #1a1a1a;
    }

    h1 {
        font-size: 1.5rem;
        margin-bottom: 0.5rem;
    }
</style>
