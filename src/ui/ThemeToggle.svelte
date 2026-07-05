<script lang="ts">
    import { toggleTheme, useTheme, type ThemeMode } from "../util/color.svelte.ts";
    import { icon_dark_mode, icon_light_mode } from "./svgicons.ts";
    import SvgIcon from "./SvgIcon.svelte";

    const theme = useTheme();
    const iconFor = (mode: ThemeMode) => (mode === "dark" ? icon_light_mode : icon_dark_mode);
</script>

<button type="button" aria-label={theme.value === "dark" ? "切换浅色模式" : "切换深色模式"} onclick={toggleTheme}>
    <SvgIcon svgPaths={iconFor(theme.value)} />
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
        padding: 0;
        vertical-align: middle;
        background: transparent;
        color: var(--accent-color, var(--raised-fg));
    }

    button:disabled {
        cursor: not-allowed;
        pointer-events: none;
        color: var(--disabled-color);
    }
</style>
