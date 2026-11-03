<script lang="ts">
	import LoadMore from '../../src/LoadMore.svelte';

	type Props = {
		api: (page: number, args?: unknown) => Promise<boolean>;
	};

	let { api }: Props = $props();

	// bind:this 暴露组件导出的 reset()
	let handle = $state<{ reset: () => void }>();
</script>

<LoadMore bind:this={handle} {api} />
<button type="button" class="reset" onclick={() => handle?.reset()}>reset</button>
