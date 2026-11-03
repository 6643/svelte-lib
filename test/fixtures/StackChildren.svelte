<script lang="ts">
	import StackBox from '../../src/StackBox.svelte';

	let { pos }: { pos?: { x?: number; y?: number }[] } = $props();
</script>

<StackBox {pos}>
	<span>a</span>
</StackBox>
