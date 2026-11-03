<script lang="ts">
	import Button from './Button.svelte';
	import { accent } from './theme.svelte.ts';
	import { useClickOutside } from './hooks/useClickOutside.ts';
	import { icon_palette } from './svgicons.ts';

	const accents = [
		{ name: 'teal', value: 'teal' },
		{ name: 'blue', value: '#2196f3' },
		{ name: 'purple', value: '#9c27b0' },
		{ name: 'pink', value: '#e91e63' },
		{ name: 'red', value: '#f44336' },
		{ name: 'orange', value: '#e95420' },
		{ name: 'green', value: '#4caf50' },
		{ name: 'indigo', value: '#3f51b5' }
	];

	let open = $state(false);

	// 面板只在打开时存在 ({#if}), 因此附件只在这一段生命周期里挂监听
	const closeOutside = useClickOutside(() => (open = false));

	const choose = (value: string) => {
		accent.set(value);
		open = false;
	};
</script>

<div class="theme-root" {@attach closeOutside}>
	<Button
		mode="icon"
		icon={icon_palette}
		onclick={() => (open = !open)}
		ariaLabel="Select accent color"
		ariaExpanded={open}
	/>
	{#if open}
		<div class="picker">
			{#each accents as item (item.value)}
				<button
					type="button"
					class="swatch"
					class:selected={accent.value === item.value}
					title={item.name}
					aria-label={item.name}
					style:background={item.value}
					onclick={() => choose(item.value)}
				></button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.theme-root {
		position: relative;
		display: inline-flex;
	}

	.picker {
		position: absolute;
		top: 100%;
		left: 0;
		display: flex;
		gap: 4px;
		padding: 4px;
		background: var(--raised-bg);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.24);
		z-index: 10;
	}

	.swatch {
		border: 2px solid transparent;
		border-radius: 50%;
		cursor: pointer;
		height: 24px;
		padding: 0;
		width: 24px;
	}

	.swatch.selected {
		border-color: var(--raised-fg);
	}
</style>
