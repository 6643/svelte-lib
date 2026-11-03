<script lang="ts">
	import ListBox from '../../src/ListBox.svelte';

	type Props = {
		items?: unknown[];
		index?: number;
		filter?: (item: unknown, i?: number) => boolean;
	};

	let {
		items = Array.from({ length: 100 }, (_, i) => `row-${i}`),
		index = 0,
		filter
	}: Props = $props();
</script>

<ListBox {items} {index} {filter}>
	{#snippet children(item, i)}
		<span>{String(item)}#{i}</span>
	{/snippet}
</ListBox>
