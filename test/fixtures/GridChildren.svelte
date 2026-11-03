<script lang="ts">
	import GridBox from '../../src/GridBox.svelte';

	let { columns, areas }: { columns?: string; areas?: string } = $props();
</script>

<GridBox {columns} {areas}>
	<span>a</span>
	<span>b</span>
</GridBox>
