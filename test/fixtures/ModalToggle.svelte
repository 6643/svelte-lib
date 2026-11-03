<script lang="ts">
	import { untrack } from 'svelte';
	import Modal from '../../src/Modal.svelte';

	let { initial = true }: { initial?: boolean } = $props();
	let open = $state(untrack(() => initial));
</script>

<button type="button" class="toggle" onclick={() => (open = !open)}>toggle</button>
<Modal mode="bottom" {open}>body</Modal>
