<script lang="ts">
	import { untrack } from 'svelte';
	import { createCountdown } from '../../src/hooks/createCountdown.svelte.ts';

	type Props = { initial?: number; interval?: number; onDone?: () => void };
	let { initial = 3, interval, onDone }: Props = $props();

	const countdown = createCountdown({
		initial: untrack(() => initial),
		interval: untrack(() => interval),
		onDone: () => untrack(() => onDone)?.()
	});
</script>

<span class="remaining">{countdown.remaining}</span>
<button type="button" class="tick" onclick={() => countdown.tick()}>tick</button>
