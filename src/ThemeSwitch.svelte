<script lang="ts">
	import Button from './Button.svelte';
	import { theme } from './theme.svelte.ts';
	import { icon_dark_mode, icon_light_mode } from './svgicons.ts';
</script>

<Button
	mode="icon"
	icon={theme.resolved === 'dark' ? icon_dark_mode : icon_light_mode}
	onclick={() => theme.toggle()}
	ariaLabel="Toggle theme"
/>
