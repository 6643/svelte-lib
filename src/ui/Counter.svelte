<script lang="ts">
    import DigitWheel from "./DigitWheel.svelte";
    import Button from "./Button.svelte";
    import { icon_remove, icon_add } from "./svgicons";

    const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

    type Props = {
        value?: number;
        change?: (value: number) => void;
        title?: string;
        min?: number;
        max?: number;
    };

    let { value: externalValue, change, min, max }: Props = $props();

    let val = $state(externalValue ?? 1);
    let direction = $state(1);

    $effect(() => {
        if (externalValue !== undefined) val = externalValue;
    });

    $effect(() => {
        change?.(val);
    });

    let nums = $derived([...String(Math.abs(val))].map(Number));
    let digitSlots = $derived(Array.from({ length: nums.length }, (_, i) => i));

    const increment = () => {
        if (max === undefined || val < max) {
            direction = 1;
            val = val + 1;
        }
    };

    const decrement = () => {
        if (min === undefined || val > min) {
            direction = -1;
            val = val - 1;
        }
    };
</script>

<div class="counter">
    <Button mode="icon" tap={decrement} svgPaths={icon_remove} />
    {#if val < 0}
        <span class="minus">-</span>
    {/if}
    {#each digitSlots as i}
        <DigitWheel values={DIGITS} value={nums[i] ?? 0} {direction} />
    {/each}
    <Button mode="icon" tap={increment} svgPaths={icon_add} />
</div>

<style>
    .counter {
        display: flex;
        align-items: center;
        gap: 0;
        height: 40px;
        padding: 4px;
    }

    .minus {
        color: var(--sunken-fg);
        font-size: 24px;
        font-weight: 600;
    }
</style>
