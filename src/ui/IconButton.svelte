<script lang="ts">
    import SvgIcon from "./SvgIcon.svelte";
    type ButtonTapHandler = () => void | Promise<void>;

    type Props = {
        color?: string;
        svgPaths: string;
        tap?: ButtonTapHandler;
        disabled?: boolean;
    };

    let { color, svgPaths, tap, disabled = false }: Props = $props();
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

<button disabled={disabled || busy} type="button" style:--color={color} onclick={handleClick}>
    <SvgIcon svgPaths={svgPaths} size={24} />
</button>

<style>
    button {
        appearance: none;
        border: 0;
        border-radius: 40px;
        box-sizing: border-box;
        cursor: pointer;
        display: inline-grid;
        place-items: center;
        font: inherit;
        min-height: 40px;
        min-width: 40px;
        overflow: hidden;
        position: relative;
        user-select: none;
        vertical-align: middle;
        transition-duration: 512ms;
        background: transparent;
        height: 40px;
        width: 40px;
        color: var(--color, var(--accent-color, var(--raised-fg)));
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
    }
</style>
