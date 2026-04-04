<svelte:options runes={true} />

<script lang="ts">
  import { lifecycle } from './route.fixture.lifecycle.ts';

  let props = $props<{ id?: number; path?: string; component?: string }>();

  $effect(() => {
    lifecycle.syncAMounts += 1;

    return () => {
      lifecycle.syncADestroys += 1;
    };
  });
</script>

<div data-testid="sync-a">{JSON.stringify(props)}</div>
