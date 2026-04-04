<svelte:options runes={true} />

<script lang="ts">
  import Route from '../route/Route.svelte';

  import SyncA from './route.fixture.SyncA.svelte';
  import SyncB from './route.fixture.SyncB.svelte';

  let current = $state(SyncA);

  export const swap = (): void => {
    current = SyncB;
  };
</script>

<Route path="/" component={current} />
