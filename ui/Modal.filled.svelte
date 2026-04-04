<script lang="ts">
    import type { Snippet } from "svelte";

    export let active = false;
    export let className = "";
    export let children: Snippet | undefined = undefined;
    export let onClose: (() => void) | undefined = undefined;

    let dialogEl: HTMLDialogElement | undefined = undefined;

    const closeModal = () => {
        active = false;
        onClose?.();
    };

    const handleBackdropClick = (event: MouseEvent & { currentTarget: EventTarget & HTMLDialogElement }) => {
        if (event.target !== event.currentTarget) return;
        closeModal();
    };

    const handleCancel = (event: Event) => {
        event.preventDefault();
        closeModal();
    };

    $: if (dialogEl) {
        if (active && !dialogEl.open) dialogEl.showModal();
        if (!active && dialogEl.open) dialogEl.close();
    }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
<dialog bind:this={dialogEl} class={`filled-modal ${className}`.trim()} oncancel={handleCancel} onclick={handleBackdropClick}>
    {#if children}
        {@render children()}
    {/if}
</dialog>

<style>
    .filled-modal {
        width: min(100vw - 24px, 960px);
        max-width: 100vw;
        border: none;
        border-radius: 12px;
        background: transparent;
        padding: 0;
    }

    .filled-modal::backdrop {
        background: rgba(0, 0, 0, 0.55);
        backdrop-filter: blur(4px);
    }
</style>
