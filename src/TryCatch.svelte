<script lang="ts">
	import type { Snippet } from 'svelte';
	import { createTry } from './hooks/createTry.svelte.ts';

	type Props = {
		// 复用外部创建的实例; 不给则自建一个
		handle?: ReturnType<typeof createTry>;
		children?: Snippet;
	};

	let { handle, children }: Props = $props();

	const fallbackHandle = createTry();
	const active = $derived(handle ?? fallbackHandle);
	const errors = $derived(active.errors);
</script>

{#if errors.length > 0}
	<ul class="try-errors">
		{#each errors as error, index (index)}
			<li>{error.info}</li>
		{/each}
	</ul>
{:else if children}
	{@render children()}
{/if}

<style>
	.try-errors {
		background-color: var(--error-color);
		color: white;
		margin-block: 0;
	}

	.try-errors > li {
		margin-top: 16px;
	}
</style>
