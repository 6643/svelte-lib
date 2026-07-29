<script lang="ts">
    import type { Snippet } from "svelte";

    type BaseProps = {
        children: Snippet;
        open: boolean;
        onClose?: VoidFunction;
        class?: string;
        width?: string;
        ariaLabel?: string;
    };
    type BottomProps = BaseProps & { height?: string };

    let {
        children, open, onClose, class: className, width, height, ariaLabel,
        mode,
    }: BottomProps & { mode: "bottom" | "top" | "left" | "right" } = $props();

    let mounted = $state(false);
    let animating = $state(false);
    let dialogEl = $state<HTMLDialogElement>();
    let closingTimer: ReturnType<typeof setTimeout> | undefined;

    let contentClass = $derived(mode === "top" ? "center" : mode === "left" || mode === "right" ? mode : undefined);

    $effect(() => {
        if (open) {
            clearTimeout(closingTimer);
            mounted = true;
            queueMicrotask(() => { animating = true; });
        } else {
            animating = false;
            closingTimer = setTimeout(() => { mounted = false; }, 256);
        }
        return () => clearTimeout(closingTimer);
    });

    $effect(() => {
        const el = dialogEl;
        const isMounted = mounted;
        if (!el) return;
        if (isMounted && !el.open) el.showModal();
        if (!isMounted && el.open) el.close();
    });

    const onKeyDown = (e: KeyboardEvent) => {
        if (e.key !== "Escape") return;
        e.preventDefault();
        onClose?.();
    };

    const closeDialog = (e: MouseEvent) => {
        if ((e.target as HTMLElement).closest(".content")) return;
        onClose?.();
    };
</script>

{#if mounted}
    <dialog
        bind:this={dialogEl}
        class="modal {mode} {className ?? ''}"
        class:active={animating}
        onkeydown={onKeyDown}
        onclick={closeDialog}
        aria-label={ariaLabel}
    >
        <div class="overlay"></div>
        <div class="content {contentClass ?? ''}" style="--max-height: {height ?? '100vh'}; --max-width: {width ?? ''}">
            {@render children()}
        </div>
    </dialog>
{/if}

<style>
    .modal:modal { max-width: 100vw; max-height: 100vh; }
    .modal {
        margin: 0; padding: 0; width: 100vw; height: 100vh;
        border: none; outline: none; background: transparent;
        color: inherit; overflow: hidden;
        transition: transform 256ms ease-out, opacity 256ms ease-out;
        opacity: 0;
    }
    .modal.active { opacity: 1; }
    .modal::backdrop { background: transparent; }

    .overlay {
        position: absolute; inset: 0; background: rgba(0,0,0,0.5);
    }
    .content {
        position: absolute; bottom: 0; left: 0;
        width: 100%; height: var(--max-height, 100vh);
        overflow-x: hidden; overflow-y: auto;
        background: white; z-index: 1;
    }
    .content.center {
        top: 0; bottom: 0; left: 0; right: 0; margin: auto;
        width: fit-content; height: fit-content;
        min-height: 160px; min-width: 320px;
        transform: translateY(-100vh);
        transition: transform 256ms ease-out;
    }
    .modal.active .content.center { transform: translateY(0); }
    .content.left { left: 0; top: 0; width: var(--max-width, 320px); height: 100vh; }
    .content.right { left: auto; right: 0; top: 0; width: var(--max-width, 320px); height: 100vh; }

    .modal.bottom { top: auto; bottom: 0; transform: translateY(100%); }
    .modal.bottom.active { transform: translateY(0); }
    .modal.left { right: auto; left: 0; top: 0; bottom: 0; transform: translateX(-100%); }
    .modal.left.active { transform: translateX(0); }
    .modal.right { left: auto; right: 0; top: 0; bottom: 0; transform: translateX(100%); }
    .modal.right.active { transform: translateX(0); }
</style>
