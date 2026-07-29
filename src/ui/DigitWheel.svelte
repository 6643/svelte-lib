<script lang="ts">
    const SPRING = 0.18;
    const FRAME_MS = 16;

    const normalizeIndex = (value: number, length: number) => ((value % length) + length) % length;

    const resolveDirectionalTarget = (current: number, targetIndex: number, length: number, direction: number) => {
        if (direction < 0) {
            return targetIndex + Math.floor((current - targetIndex) / length) * length;
        }
        return targetIndex + Math.ceil((current - targetIndex) / length) * length;
    };

    type Props = {
        values: number[];
        value: number;
        direction?: number;
    };

    let { values: valuesProp, value, direction = 1 }: Props = $props();

    let values = $derived(valuesProp.length > 0 ? valuesProp : [0]);
    let targetIndex = $derived(Math.max(0, values.indexOf(value)));
    let dir = $derived(direction < 0 ? -1 : 1);

    // ── 弹簧动画数字 ──
    let springValue = $state(0);
    let initialized = $state(false);
    let target = $state(0);
    let timer: ReturnType<typeof setTimeout> | undefined;

    const stop = () => {
        if (timer) clearTimeout(timer);
        timer = undefined;
    };

    const tick = () => {
        const current = springValue;
        const delta = target - current;
        if (Math.abs(delta) < 0.001) {
            springValue = target;
            stop();
            return;
        }
        springValue = current + delta * SPRING;
        timer = setTimeout(tick, FRAME_MS);
    };

    $effect(() => {
        const len = values.length;
        const nextTarget = targetIndex;
        const direction = dir;

        const current = springValue;
        const resolvedTarget = initialized
            ? resolveDirectionalTarget(current, nextTarget, len, direction)
            : nextTarget;
        initialized = true;
        target = resolvedTarget;
        if (!timer) {
            if (current !== resolvedTarget) {
                tick();
            } else {
                springValue = resolvedTarget;
            }
        }
        return stop;
    });

    let position = $derived(springValue);
    let currentIndex = $derived(Math.floor(position));
    let nextIndex = $derived(currentIndex + 1);
    let offset = $derived(`${100 * (position - currentIndex)}%`);
</script>

<div class="viewport">
    <div class="digits" style="--offset: {offset}">
        <strong class="next" aria-hidden="true">{values[normalizeIndex(nextIndex, values.length)]}</strong>
        <strong class="current">{values[normalizeIndex(currentIndex, values.length)]}</strong>
    </div>
</div>

<style>
    .viewport {
        width: 1em;
        height: 1em;
        overflow: hidden;
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        line-height: 1;
    }

    .digits {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        transition: transform calc(1s * 0.32) ease;
        transform: translateY(calc(-50% - 0.5 * var(--offset, 0%)));
    }

    .current,
    .next {
        height: 1em;
        display: flex;
        align-items: center;
        justify-content: center;
    }
</style>
