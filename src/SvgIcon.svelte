<script lang="ts">
	type Props = {
		// SVG path data, 必须是 svgicons.ts 里的常量
		svgPaths: string;
		// 填充色, 缺省继承 currentColor
		color?: string;
		size?: 20 | 24 | 40 | 48;
	};

	let { svgPaths, color, size = 24 }: Props = $props();
</script>

<svg viewBox="0 -960 960 960" width={size} height={size} style:--color={color} aria-hidden="true">
	{@html svgPaths}
</svg>

<style>
	svg {
		fill: var(--color, currentColor);
		vertical-align: middle;
	}
</style>
