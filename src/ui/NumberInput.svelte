<script lang="ts">
    import { useValidation } from "../util/useValidation.svelte.ts";
    import Button from "./Button.svelte";
    import { icon_add, icon_remove } from "./svgicons";
    import type { Snippet } from "svelte";

    type ValidateResult = string | undefined | Promise<string | undefined>;

    type Props = {
        label: string;
        value?: number;
        changed?: (value: number) => void;
        min?: number;
        max?: number;
        step?: number;
        unit?: string;
        left?: Snippet;
        right?: Snippet;
        validate?: (value: string) => ValidateResult;
    };

    let { label, value: external, changed, min, max, step = 1, unit, left, right, validate }: Props = $props();
    let val = $state(external ?? min ?? 0);

    $effect(() => { if (external !== undefined) val = external; });

    let { error, checking } = useValidation(() => String(val), validate);
    let hasError = $derived(!!error);

    const clamp = (v: number) => {
        if (min != null && v < min) return min;
        if (max != null && v > max) return max;
        return v;
    };

    const increment = () => { if (!changed) return; const v = clamp(val + step); val = v; changed(v); };
    const decrement = () => { if (!changed) return; const v = clamp(val - step); val = v; changed(v); };

    const onInput = (e: Event) => {
        const v = (e.target as HTMLInputElement).valueAsNumber;
        if (!isNaN(v)) { val = v; changed?.(v); }
    };
</script>

<label class="field" class:error={hasError}>
    <div>
        <span>{label}</span>
        <span data-unit={unit}>{val}</span>
        <span class="fieldError">{checking ? "校验中..." : (error ?? "")}</span>
    </div>
    <div class="inputWrap">
        {#if left}{@render left()}{/if}
        <div class="inputGrow">
            <input type="number" value={val} oninput={onInput} placeholder=" " spellcheck={false}
                readonly={!changed} {min} {max} {step} />
        </div>
        <Button mode="icon" tap={decrement} svgPaths={icon_remove} />
        <Button mode="icon" tap={increment} svgPaths={icon_add} />
        {#if right}{@render right()}{/if}
    </div>
</label>

<style>
    .field { display: flex; flex-direction: column; }
    .field > div:first-child { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
    .inputWrap {
        display: flex; align-items: center; gap: 4px; width: 100%; height: 40px;
        background: var(--base-bg); border: 2px solid transparent; border-radius: 3px;
        transition: border-color 160ms ease;
    }
    .inputWrap:has(input:focus) { border-color: var(--accent-color); }
    .field.error .inputWrap { border-color: var(--error-color); }
    .inputGrow { flex: 1; min-width: 0; }
    .inputGrow input {
        appearance: none; background: transparent; border: none; color: inherit;
        box-shadow: none; outline: 0; width: 100%; box-sizing: border-box;
        padding: 0 8px; line-height: 36px;
    }
    .inputGrow input[type="number"]::-webkit-inner-spin-button,
    .inputGrow input[type="number"]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
    .inputGrow input[type="number"] { appearance: textfield; }
    .inputGrow input:disabled { color: var(--sunken-fg); cursor: not-allowed; }
    .fieldError { color: var(--error-color); }
</style>
