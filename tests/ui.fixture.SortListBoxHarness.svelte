<svelte:options runes={true} />

<script lang="ts">
    import SortListBox from "../ui/SortListBox.svelte";

    const items = ["A", "B", "C"];
</script>

<SortListBox {items} hookChange={() => {}}>
    {#snippet renderItem(item)}
        <span>{item}</span>
    {/snippet}
</SortListBox>
