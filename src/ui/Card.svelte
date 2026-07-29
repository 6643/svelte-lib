<script lang="ts">
    import type { Snippet } from "svelte";

    type Props = {
        class?: string;
        children?: Snippet;
    };

    let { class: className, children }: Props = $props();
</script>

<div class="card {className ?? ''}">
    {#if children}{@render children()}{/if}
</div>

<style>
    .card {
        background: var(--raised-bg);
        border-radius: 3px;
        color: var(--raised-fg);
        padding: 8px;
    }
</style>
