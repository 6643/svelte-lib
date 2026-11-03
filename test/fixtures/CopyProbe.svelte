<script lang="ts">
	import { createCopy } from '../../src/hooks/createCopy.svelte.ts';

	const copy = createCopy();
</script>

<span class="copied">{String(copy.copied)}</span>
<button type="button" class="copy" onclick={() => void copy.copy('hello')}>copy</button>
