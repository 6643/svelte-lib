<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		children?: Snippet;
		className?: string;
	};

	let { children, className }: Props = $props();
</script>

<div class="card {className}">
	{@render children?.()}
</div>

<style>
	.card {
		background: var(--raised-bg);
		border-radius: 3px;
		color: var(--raised-fg);
		padding: 8px;
	}
</style>
