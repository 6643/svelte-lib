<script lang="ts">
    import DigitWheel from "./DigitWheel.svelte";

    const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

    function parseTime(totalSeconds: number): number[] {
        if (totalSeconds < 1) return [0, 0, 0, 0, 0];
        const hours = Math.floor(totalSeconds / 3600);
        const remainingAfterHours = totalSeconds % 3600;
        const minutes = Math.floor(remainingAfterHours / 60);
        const seconds = remainingAfterHours % 60;
        const formattedHoursDigits = String(hours).split("").map(Number);
        const formattedMinutesDigits = String(minutes).padStart(2, "0").split("").map(Number);
        const formattedSecondsDigits = String(seconds).padStart(2, "0").split("").map(Number);
        return [...formattedHoursDigits, ...formattedMinutesDigits, ...formattedSecondsDigits];
    }

    type Props = {
        value: number;
        done?: VoidFunction;
    };

    let { value, done }: Props = $props();

    let val = $state(value);
    let hms = $derived(parseTime(val));
    let digitSlots = $derived(Array.from({ length: hms.length }, (_, i) => i));

    const isSplit = (array: number[], index: number) => {
        const length = array.length;
        const isSecondToLast = length >= 2 && index === length - 2;
        const isFourthToLast = length >= 4 && index === length - 4;
        return isSecondToLast || isFourthToLast;
    };

    // 倒计时定时器
    $effect(() => {
        let finished = false;
        const timer = setInterval(() => {
            if (val <= 0) {
                if (!finished) {
                    finished = true;
                    done?.();
                }
                clearInterval(timer);
                return;
            }
            val = val - 1;
            if (val === 0) {
                queueMicrotask(() => {
                    if (finished) return;
                    finished = true;
                    done?.();
                    clearInterval(timer);
                });
            }
        }, 1000);
        return () => clearInterval(timer);
    });
</script>

<div class="countdown">
    {#each digitSlots as i}
        {#if isSplit(hms, i)}
            <span class="sep">:</span>
        {/if}
        <DigitWheel values={DIGITS} value={hms[i] ?? 0} direction={-1} />
    {/each}
</div>

<style>
    .countdown {
        display: flex;
        align-items: center;
        gap: 0;
        height: 40px;
        padding: 4px;
    }

    .sep {
        color: var(--sunken-fg);
        font-size: 24px;
        font-weight: 600;
    }
</style>
