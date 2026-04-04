<script>
    export let bgColor = undefined;
    export let borderRadius = undefined;
    export let color = undefined;
    export let height = undefined;
    export let icon = "";
    export let tap = undefined;
    export let text = "";
    export let width = undefined;

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

<button
    class="filled-button"
    class:running={isRunning}
    disabled={!tap || isRunning}
    onclick={handleClick}
    style:background-color={bgColor}
    style:border-radius={borderRadius ? `${borderRadius}px` : undefined}
    style:color={color}
    style:height={height ? `${height}px` : undefined}
    style:width={width ? `${width}px` : undefined}
>
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
    .filled-button {
        user-select: none;
        vertical-align: middle;
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 0 16px;
        min-height: 40px;
        min-width: 40px;
        border-radius: 20px;
        border: none;
        outline: none;
        cursor: pointer;
        overflow: hidden;
        transition-duration: 256ms;
        background-color: var(--theme-color);
        color: white;
    }

    .filled-button:disabled {
        cursor: not-allowed;
        pointer-events: none;
        background-color: var(--sb-color);
        color: var(--sf-color);
    }

    .filled-button svg {
        width: 24px;
        height: 24px;
        fill: currentColor;
    }
</style>
