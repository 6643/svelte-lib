<script lang="ts">
    import type { Snippet } from "svelte";

    type Props = {
        active?: boolean;
        className?: string;
        children?: Snippet;
        onClose?: () => void;
    };

    let {
        active = false,
        className = "",
        children,
        onClose,
    }: Props = $props();

    let currentActive = $state(false);
    let dialogEl = $state<HTMLDialogElement | undefined>(undefined);

    const closeModal = (): void => {
        currentActive = false;
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

    $effect.pre(() => {
        currentActive = active;
    });

    $effect(() => {
        const dialog = dialogEl;
        if (!dialog) return;

        if (currentActive && !dialog.open) dialog.showModal();
        if (!currentActive && dialog.open) dialog.close();
    });
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
