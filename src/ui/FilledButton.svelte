<script lang="ts">
    import type { Snippet } from "svelte";

    type ButtonTapHandler = () => void | Promise<void>;

    type Props = {
        children: Snippet;

        borderRadius?: number | string;
        bgColor?: string;
        color?: string;
        width?: number | string;
        height?: number | string;
        tap?: ButtonTapHandler;
        disabled?: boolean;
    };

    let { children, borderRadius, bgColor, color, width, height, tap, disabled = false }: Props = $props();
    let busy = $state(false);

    const handleClick = async () => {
        if (busy) return;
        busy = true;
        try {
            const result = tap?.();
            if (result && typeof (result as PromiseLike<void>).then === "function") await result;
        } finally {
            busy = false;
        }
    };
</script>

<button
    disabled={disabled || busy}
    type="button"
    style:--bg={bgColor}
    style:--radius={typeof borderRadius === "number" ? `${borderRadius}px` : borderRadius}
    style:--color={color}
    style:--height={typeof height === "number" ? `${height}px` : height}
    style:--width={typeof width === "number" ? `${width}px` : width}
    onclick={handleClick}
>
    {@render children()}
</button>

<style>
    button {
        appearance: none;
        border: 0;
        border-radius: var(--radius, 3px);
        box-sizing: border-box;
        cursor: pointer;
        align-items: center;
        display: inline-flex;
        font: inherit;
        gap: 8px;
        justify-content: center;
        min-height: 40px;
        min-width: 40px;
        overflow: hidden;
        position: relative;
        user-select: none;
        vertical-align: middle;
        transition-duration: 512ms;
        color: white;
        padding: 0 16px;
        background-color: var(--bg, var(--accent-color));
        height: var(--height);
        width: var(--width);
        padding: 0 16px;
    }

    button::before {
        content: "";
        width: 100%;
        height: 100%;
        position: absolute;
        top: 0;
        left: 0;
        background-image: radial-gradient(circle, currentColor 10%, transparent 10%);
        background-size: 1000% 1000%;
        background-position: 50%;
        pointer-events: none;
        transition: 512ms;
        opacity: 0;
    }

    button:active::before {
        background-size: 0 0;
        opacity: 0.28;
        transition: none;
    }

    @keyframes breathe {
        0%,
        100% {
            box-shadow: inset 0 0 0 2px var(--accent-color);
        }
        50% {
            box-shadow: inset 0 0 6px 2px var(--accent-color);
        }
    }

    button:focus-visible {
        animation: breathe 2s ease-in-out infinite;
    }

    button:disabled {
        box-shadow: none;
        cursor: not-allowed;
        pointer-events: none;
        color: var(--disabled-color);
        background-color: var(--sunken-bg);
    }
</style>
