<script lang="ts">
    import type { Snippet } from "svelte";

    type Props = {
        changed?: (value: string) => void;
        left?: Snippet;
        label?: string;
        maxLen?: number;
        minLen?: number;
        right?: Snippet;
        validate?: (value: string) => string | undefined;
        value?: string;
    };

    let {
        changed,
        left,
        label = "",
        maxLen,
        minLen,
        right,
        validate,
        value = "",
    }: Props = $props();

    let currentValue = $state("");
    let error = $derived(validate?.(currentValue));

    $effect.pre(() => {
        currentValue = value ?? "";
    });

    const handleInput = (event: Event & { currentTarget: EventTarget & HTMLInputElement }) => {
        const nextValue = event.currentTarget.value;
        currentValue = nextValue;
        changed?.(nextValue);
    };
</script>

<label class="string-input" class:error={!!error}>
    <div>
        <span>{label}</span>
        <span>{error ?? ""}</span>
    </div>

    <div>
        {#if left}
            {@render left()}
        {/if}
        <input inputmode="text" maxlength={maxLen} minlength={minLen} oninput={handleInput} placeholder=" " readOnly={!changed} spellcheck={false} value={currentValue} />
        {#if right}
            {@render right()}
        {/if}
    </div>
</label>

<style>
    .string-input {
        width: 100%;
        min-height: 64px;
        position: relative;
        border-top-left-radius: 9px;
        border-top-right-radius: 9px;
        border-bottom: 2px solid var(--sf-color);
        transition: border-bottom-color 256ms ease;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        color: var(--sf-color);
        background-color: var(--sb-color);
        padding: 0 8px;
    }

    .string-input:focus-within {
        border-bottom-color: var(--theme-color);
    }

    .string-input > div:first-child {
        transition: all 256ms ease-out;
        color: var(--sf-color);
        width: 100%;
        display: flex;
        justify-content: space-between;
    }

    .string-input:focus-within > div:first-child > span:first-child {
        color: var(--theme-color);
    }

    .string-input > div:last-child {
        width: 100%;
        flex-grow: 1;
        display: flex;
    }

    .string-input input {
        all: unset;
        width: 100%;
        height: 24px;
        padding-top: 8px;
    }

    .string-input.error {
        border-bottom-color: #d13d3d;
    }
</style>
