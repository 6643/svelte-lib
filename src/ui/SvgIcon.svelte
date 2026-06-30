<script lang="ts">
    type Props = {
        svgPaths: string;
        color?: string;
        size?: 20 | 24 | 40 | 48;
    };

    let { svgPaths, color, size = 24 }: Props = $props();
</script>

<svg viewBox="0 -960 960 960" width={size} height={size} style:color aria-hidden="true">
    {@html svgPaths}
</svg>

<style>
    svg {
        fill: var(--color, currentColor);
        vertical-align: middle;
    }
</style>
