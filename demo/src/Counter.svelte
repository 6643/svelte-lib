<script lang="ts">
    let count = $state(0);
    const increment = () => count += 1;
    const decrement = () => count -= 1;
</script>

<div class="counter">
    <p>Count: <strong>{count}</strong></p>
    <button onclick={decrement}>-</button>
    <button onclick={increment}>+</button>
</div>

<style>
    .counter {
        margin-top: 1.5rem;
        padding: 1rem;
        border: 1px solid #ddd;
        border-radius: 8px;
        background: white;
    }

    button {
        margin-right: 0.5rem;
        padding: 0.4rem 0.8rem;
        font-size: 1rem;
        border: 1px solid #ccc;
        border-radius: 4px;
        background: #f0f0f0;
        cursor: pointer;
    }

    button:hover {
        background: #e0e0e0;
    }
</style>
