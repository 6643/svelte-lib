<script lang="ts">
	import FlexBox from '../../src/FlexBox.svelte';

	let { fg }: { fg?: number[] } = $props();
</script>

<FlexBox {fg}>
	<span>a</span>
	<span>b</span>
</FlexBox>
