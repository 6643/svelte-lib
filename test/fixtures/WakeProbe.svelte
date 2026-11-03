<script lang="ts">
	import { createWakeLock } from '../../src/hooks/createWakeLock.svelte.ts';

	const lock = createWakeLock();
	lock.setActive(true);
</script>

<span class="supported">{String(lock.supported)}</span>
<span class="active">{String(lock.active)}</span>
