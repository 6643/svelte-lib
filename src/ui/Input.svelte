<script lang="ts">
    import type { Snippet } from "svelte";
    import { useValidation } from "../util/useValidation.svelte.ts";
    import type { ValidateResult } from "../util/useValidation.svelte.ts";

    type Props = {
        label: string;
        value?: string;
        validate?: (value: string) => ValidateResult;
        left?: Snippet;
        right?: Snippet;
        children: Snippet;
    };

    let {
        label, value: _val, validate, left, right, children
    }: Props = $props();

    const { error, checking } = useValidation(() => _val ?? "", validate);
    let hasError = $derived(!!error);
</script>

<label class="field" class:error={hasError}>
    <div>
        <span>{label}</span>
        <span class="fieldError">{checking ? "校验中..." : (error ?? "")}</span>
    </div>
    <div class="inputWrap">
        {#if left}{@render left()}{/if}
        <div class="inputGrow">{@render children()}</div>
        {#if right}{@render right()}{/if}
    </div>
</label>

<style>
    .field { display: flex; flex-direction: column; }
    .field > div:first-child { display: flex; justify-content: space-between; align-items: center; }
    .inputWrap { display: flex; align-items: center; gap: 4px; width: 100%; height: 40px; background: var(--base-bg); border: 2px solid transparent; border-radius: 3px; transition: border-color 160ms ease; }
    .inputWrap:has(input:focus) { border: 2px solid var(--accent-color); box-shadow: none; }
    .field.error .inputWrap { border: 2px solid var(--error-color); box-shadow: none; }
    .inputGrow { flex: 1; min-width: 0; }

    .inputGrow :global(input),
    .inputGrow :global(textarea) {
        appearance: none;
        background: transparent;
        border: none;
        color: inherit;
        box-shadow: none;
        outline: 0;
        width: 100%;
        box-sizing: border-box;
        padding: 0 8px;
        line-height: 36px;
    }

    .inputGrow :global(textarea) {
        resize: vertical;
        padding: 11px 8px;
        line-height: 1.5;
    }

    .inputGrow :global(input[type="number"])::-webkit-inner-spin-button,
    .inputGrow :global(input[type="number"])::-webkit-outer-spin-button {
        -webkit-appearance: none;
        margin: 0;
    }

    .inputGrow :global(input[type="number"]) {
        appearance: textfield;
    }

    .inputGrow :global(input:-webkit-autofill),
    .inputGrow :global(textarea:-webkit-autofill) {
        -webkit-box-shadow: 0 0 0 1000px var(--sunken-bg) inset;
        -webkit-text-fill-color: var(--sunken-fg);
    }

    .inputGrow :global(input:-webkit-autofill:focus),
    .inputGrow :global(textarea:-webkit-autofill:focus) {
        -webkit-box-shadow: 0 0 0 1000px var(--sunken-bg) inset;
        -webkit-text-fill-color: var(--sunken-fg);
    }

    .inputGrow :global(input::placeholder),
    .inputGrow :global(textarea::placeholder) {
        color: var(--disabled-color);
    }

    .inputGrow :global(input:disabled),
    .inputGrow :global(textarea:disabled) {
        color: var(--sunken-fg);
        cursor: not-allowed;
    }

    .fieldError {
        color: var(--error-color);
    }
</style>
