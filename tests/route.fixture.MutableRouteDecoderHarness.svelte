<svelte:options runes={true} />

<script lang="ts">
  import Route from '../route/Route.svelte';

  import SyncA from './route.fixture.SyncA.svelte';

  let current = $state<NumberConstructor | StringConstructor>(Number);

  export const swap = (): void => {
    current = String;
  };
</script>

<Route path="/decoder" component={SyncA} $id={current} />
