<script lang="ts">
    import SvgIcon from "./SvgIcon.svelte";
    import type { Snippet } from "svelte";

    type ButtonTapHandler = () => void | Promise<void>;

    // ── 公用（所有 variant 都有）──
    type Shared = {
        mode: "icon" | "text" | "filled" | "outlined";
        tap?: ButtonTapHandler;
        disabled?: boolean;
        /** 文字/图标颜色 */
        color?: string;
    };

    // ── Icon ──
    type IconProps = Shared & {
        mode: "icon";
        /** SVG path data */
        svgPaths: string;
    };

    // ── Text ──
    type TextProps = Shared & {
        mode: "text";
        /** 按钮文字 */
        text: string;
        /** 可选图标（SVG path data） */
        iconPaths?: string;
    };

    // ── Filled ──
    type FilledProps = Shared & {
        mode: "filled";
        children: Snippet;
        /** 背景色 */
        bgColor?: string;
        /** 圆角 */
        borderRadius?: number | string;
        /** 宽度 */
        width?: number | string;
        /** 高度 */
        height?: number | string;
    };

    // ── Outlined ──
    type OutlinedProps = Shared & {
        mode: "outlined";
        children: Snippet;
        /** 圆角 */
        borderRadius?: number | string;
        /** 宽度 */
        width?: number | string;
        /** 高度 */
        height?: number | string;
    };

    type Props = IconProps | TextProps | FilledProps | OutlinedProps;

    // ── 不解构，保留联合类型 ──
    let props: Props = $props();

    let busy = $state(false);

    // ── 提取 variant-specific 的 CSS 属性 ──
    let cssBgColor = $derived(props.mode === "filled" ? (props as FilledProps).bgColor : undefined);
    let cssBorderRadius = $derived(
        props.mode === "filled" || props.mode === "outlined"
            ? (props as FilledProps | OutlinedProps).borderRadius
            : undefined,
    );
    let cssWidth = $derived(
        props.mode === "filled" || props.mode === "outlined" ? (props as FilledProps | OutlinedProps).width : undefined,
    );
    let cssHeight = $derived(
        props.mode === "filled" || props.mode === "outlined" ? (props as FilledProps | OutlinedProps).height : undefined,
    );

    const toCssSize = (value: number | string | undefined): string | undefined =>
        typeof value === "number" ? `${value}px` : value;

    const handleClick = async () => {
        if (busy) return;
        busy = true;
        try {
            const result = props.tap?.();
            if (result && typeof (result as PromiseLike<void>).then === "function") await result;
        } finally {
            busy = false;
        }
    };
</script>

<button
    disabled={props.disabled || busy}
    type="button"
    class={props.mode}
    style:--color={props.color}
    style:--bg={cssBgColor}
    style:--radius={toCssSize(cssBorderRadius)}
    style:--height={toCssSize(cssHeight)}
    style:--width={toCssSize(cssWidth)}
    onclick={handleClick}
>
    {#if props.mode === "icon"}
        <SvgIcon svgPaths={props.svgPaths} size={24} />
    {:else if props.mode === "text"}
        {#if props.iconPaths}
            <SvgIcon svgPaths={props.iconPaths} size={24} />
        {/if}
        <span>{props.text}</span>
    {:else}
        <!-- filled / outlined -->
        {#if props.children}
            {@render props.children()}
        {/if}
    {/if}
</button>

<style>
    /* ============ Base ============ */

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

    /* ============ Icon ============ */

    .icon {
        background: transparent;
        border-radius: 40px;
        height: 40px;
        width: 40px;
        color: var(--color, var(--accent-color, var(--raised-fg)));
    }

    /* ============ Text ============ */

    .text {
        background: transparent;
        box-shadow: none;
        color: var(--color, var(--accent-color, var(--raised-fg)));
        padding: 0 16px;
    }

    /* ============ Filled ============ */

    .filled {
        color: white;
        background-color: var(--bg, var(--accent-color));
        height: var(--height);
        width: var(--width);
        padding: 0 16px;
    }

    .filled:disabled {
        background-color: var(--sunken-bg);
    }

    /* ============ Outlined ============ */

    .outlined {
        color: var(--color, var(--accent-color, var(--raised-fg)));
        background: transparent;
        border: 2px solid var(--color, var(--accent-color));
        box-shadow: none;
        height: var(--height);
        width: var(--width);
        padding: 0 16px;
    }

    .outlined:disabled {
        border-color: var(--disabled-color);
    }
</style>
