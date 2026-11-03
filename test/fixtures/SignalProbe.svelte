<script lang="ts">
	import { untrack } from 'svelte';
	import { createDebouncedSignal } from '../../src/hooks/createDebouncedSignal.svelte.ts';
	import { createMediaQuery } from '../../src/hooks/createMediaQuery.svelte.ts';
	import { createFullscreen } from '../../src/hooks/createFullscreen.svelte.ts';
	import { createStorage } from '../../src/hooks/createStorage.svelte.ts';
	import { createCopy } from '../../src/hooks/createCopy.svelte.ts';

	type Props = { source?: string; query?: string; debounceMs?: number };
	let { source = 'a', query = '(min-width: 600px)', debounceMs = 100 }: Props = $props();

	const debounced = createDebouncedSignal(() => source, untrack(() => debounceMs));
	const media = createMediaQuery(untrack(() => query));
	const fullscreen = createFullscreen();
	const storage = createStorage<string>('probe:key', 'init');
	const copy = createCopy();
</script>

<span class="debounced">{debounced.current}</span>
<span class="matches">{String(media.current)}</span>
<span class="fullscreen">{String(fullscreen.isFullscreen)}</span>
<span class="storage">{storage.value}</span>
<span class="copied">{String(copy.copied)}</span>
<button type="button" class="toggle-fullscreen" onclick={fullscreen.toggle}>fs</button>
<button type="button" class="bump-storage" onclick={() => storage.update((prev) => `${prev}+`)}>
	bump
</button>
<button type="button" class="copy" onclick={() => void copy.copy('hi')}>copy</button>
