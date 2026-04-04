<script lang="ts">
    let count = $state(0);

    const increment = (): void => {
        count++;
    };
</script>

<div class="counter">
    <h1>Svelte 5 Counter</h1>
    <p>Count: {count}</p>
    <button onclick={increment}>Increment</button>
</div>

<style>
    .counter {
        font-family: system-ui, sans-serif;
        text-align: center;
        padding: 2rem;
    }

    button {
        background: #ff3e00;
        color: white;
        border: none;
        padding: 0.5rem 1rem;
        border-radius: 4px;
        cursor: pointer;
        font-size: 1rem;
    }

    button:hover {
        background: #ff5722;
    }
</style>
