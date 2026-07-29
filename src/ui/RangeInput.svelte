<script lang="ts">
    import type { Snippet } from "svelte";

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
    };

    let { label, value: external, changed, min = 0, max = 100, step = 1, unit, left, right }: Props = $props();
    let val = $state(external ?? min);
    $effect(() => { if (external !== undefined) val = external; });

    const inputed = (e: Event) => {
        const v = (e.target as HTMLInputElement).valueAsNumber;
        val = v;
        changed?.(v);
    };
</script>

<label class="rangeInput">
    <div>
        <span>{label}</span>
        <span data-unit={unit}>{val}</span>
    </div>
    <div>
        {#if left}{@render left()}{/if}
        <input type="range" {min} {max} value={val} {step} oninput={inputed} spellcheck={false} readonly={!changed} />
        {#if right}{@render right()}{/if}
    </div>
</label>

<style>
    .rangeInput { display: flex; flex-direction: column; gap: 4px; }
    .rangeInput > div { display: flex; justify-content: space-between; align-items: center; }
    .rangeInput input[type="range"] {
        width: 100%; appearance: none; background: transparent; cursor: pointer;
    }
    .rangeInput input[type="range"]::-webkit-slider-runnable-track,
    .rangeInput input[type="range"]::-moz-range-track {
        height: 4px; border-radius: 2px; background: var(--sunken-bg);
        box-shadow: inset 0 1px 2px rgba(0,0,0,0.12);
    }
    .rangeInput input[type="range"]::-webkit-slider-thumb,
    .rangeInput input[type="range"]::-moz-range-thumb {
        appearance: none; width: 20px; height: 20px; border-radius: 50%;
        background: var(--accent-color); box-shadow: 0 2px 6px rgba(0,0,0,0.18);
    }
    .rangeInput input[type="range"]::-webkit-slider-thumb { margin-top: -8px; }
    .rangeInput input[type="range"]::-moz-range-thumb { border: none; }
</style>
