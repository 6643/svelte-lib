<script lang="ts">
	import Tab from '../../src/Tab.svelte';
	import type { TabItem, TabMode } from '../../src/tabTypes.ts';

	type Props = {
		kind: TabMode;
		items: TabItem[];
		onchange?: (index: number) => void;
	};

	let { kind, items, onchange }: Props = $props();
</script>

{#snippet panel(index: number)}
	<p>panel-{index}</p>
{/snippet}

<Tab mode={kind} {items} {panel} onchange={onchange} />
