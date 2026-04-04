<script>
    export let color = undefined;
    export let icon = "";
    export let tap = undefined;
    export let text = "";

    let isRunning = false;

    const handleClick = async (event) => {
        event.stopPropagation();
        if (!tap || isRunning) return;

        isRunning = true;

        try {
            await tap();
        } finally {
            isRunning = false;
        }
    };
</script>

<button class="text-button" disabled={!tap || isRunning} onclick={handleClick} style:color={color}>
    {#if icon}
        <svg viewBox="0 -960 960 960" aria-hidden="true">
            {@html icon}
        </svg>
    {/if}
    {#if text}
        <span>{text}</span>
    {/if}
</button>

<style>
    .text-button {
        user-select: none;
        vertical-align: middle;
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 0 16px;
        min-height: 40px;
        border-radius: 20px;
        border: none;
        outline: none;
        cursor: pointer;
        overflow: hidden;
        transition-duration: 256ms;
        background-color: transparent;
        color: var(--theme-color);
    }

    .text-button:disabled {
        cursor: not-allowed;
        pointer-events: none;
        color: var(--sf-color);
    }

    .text-button svg {
        width: 24px;
        height: 24px;
        fill: currentColor;
    }
</style>
