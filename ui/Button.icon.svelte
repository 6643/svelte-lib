<script>
    export let color = undefined;
    export let icon = "";
    export let tap = undefined;

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

<button class="icon-button" disabled={!tap || isRunning} onclick={handleClick} style:color={color}>
    {#if icon}
        <svg viewBox="0 -960 960 960" aria-hidden="true">
            {@html icon}
        </svg>
    {/if}
</button>

<style>
    .icon-button {
        user-select: none;
        vertical-align: middle;
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 40px;
        height: 40px;
        min-width: 40px;
        padding: 0;
        border-radius: 50%;
        border: none;
        outline: none;
        cursor: pointer;
        overflow: hidden;
        transition-duration: 256ms;
        background-color: transparent;
        color: var(--pf-color);
    }

    .icon-button:disabled {
        cursor: not-allowed;
        pointer-events: none;
        opacity: 0.6;
    }

    .icon-button svg {
        width: 24px;
        height: 24px;
        fill: currentColor;
    }
</style>
