<svelte:options runes={true} />

<script lang="ts">
  let props = $props<{ id?: number }>();
</script>

<div data-testid="sync-b">{JSON.stringify(props)}</div>
