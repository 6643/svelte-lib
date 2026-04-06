<script lang="ts">
    import type { Snippet } from "svelte";

    type Props = {
        changed?: (value: number) => void;
        left?: Snippet;
        label?: string;
        max?: number;
        min?: number;
        right?: Snippet;
        step?: number;
        unit?: string;
        value?: number;
    };

    let {
        changed,
        left,
        label = "",
        max = 100,
        min = 0,
        right,
        step = 1,
        unit = "",
        value = 0,
    }: Props = $props();

    let currentValue = $state(0);

    $effect.pre(() => {
        currentValue = value ?? min;
    });

    const handleInput = (event: Event & { currentTarget: EventTarget & HTMLInputElement }) => {
        const nextValue = event.currentTarget.valueAsNumber;
        currentValue = nextValue;
        changed?.(nextValue);
    };
</script>

<label class="range-input">
    <div>
        <span>{label}</span>
        <span data-unit={unit}>{currentValue}</span>
    </div>

    <div>
        {#if left}
            {@render left()}
        {/if}
        <input max={max} min={min} oninput={handleInput} readOnly={!changed} step={step} type="range" value={currentValue} />
        {#if right}
            {@render right()}
        {/if}
    </div>
</label>

<style>
    .range-input {
        width: 100%;
        min-height: 64px;
        color: var(--sf-color);
        background-color: var(--sb-color);
        padding: 4px 4px 0;
        border-radius: 5px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
    }

    .range-input:focus-within > div {
        color: var(--theme-color);
    }

    .range-input > div {
        width: 100%;
        display: flex;
        justify-content: space-between;
        gap: 4px;
    }

    .range-input > div:first-child > :last-child::after {
        content: attr(data-unit);
        font-size: smaller;
        color: var(--sf-color);
        font-style: italic;
        margin-left: 2px;
    }

    .range-input input[type="range"] {
        -webkit-appearance: none;
        appearance: none;
        width: 100%;
        height: 10px;
        cursor: pointer;
        margin: 10px 0;
        background: transparent;
    }

    .range-input input[type="range"]::-webkit-slider-thumb {
        -webkit-appearance: none;
        appearance: none;
        height: 16px;
        width: 16px;
        background-color: var(--theme-color);
        border-radius: 50%;
        border: 3px solid rgba(255, 255, 255, 0.75);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        margin-top: -6.5px;
    }

    .range-input input[type="range"]::-webkit-slider-runnable-track {
        width: 100%;
        height: 3px;
        background-color: var(--sf-color);
        border-radius: 5px;
    }
</style>
