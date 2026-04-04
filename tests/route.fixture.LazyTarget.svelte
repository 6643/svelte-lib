<svelte:options runes={true} />

<script lang="ts">
  let props = $props<{ id?: number }>();
</script>

<div data-testid="lazy-target">{JSON.stringify(props)}</div>
