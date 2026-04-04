<svelte:options runes={true} />

<script lang="ts">
  import Route from '../route/Route.svelte';

  import SyncA from './route.fixture.SyncA.svelte';

  let current = $state('/a');

  export const swap = (): void => {
    current = '/b';
  };
</script>

<Route path={current} component={SyncA} />
