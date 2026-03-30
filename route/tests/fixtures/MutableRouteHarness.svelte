<svelte:options runes={true} />

<script lang="ts">
  import Route from '../../Route.svelte';

  import SyncA from './SyncA.svelte';
  import SyncB from './SyncB.svelte';

  let current = $state(SyncA);

  export const swap = (): void => {
    current = SyncB;
  };
</script>

<Route path="/" component={current} />
