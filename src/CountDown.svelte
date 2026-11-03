<script lang="ts">
	import { untrack } from 'svelte';
	import DigitRow from './DigitRow.svelte';
	import { DIGITS } from './utils/digits.ts';
	import { createCountdown } from './hooks/createCountdown.svelte.ts';

	type Props = {
		// 起始秒数
		value: number;
		// 倒数到 0 时触发一次
		onDone?: () => void;
	};

	let { value, onDone }: Props = $props();

	// 总秒数拆成 [时, 分, 秒] 的数字序列; 分秒补足两位, 小于 1 秒统一 00:00.
	const parseTime = (totalSeconds: number): number[] => {
		if (totalSeconds < 1) return [0, 0, 0, 0, 0];

		const hours = Math.floor(totalSeconds / 3600);
		const rest = totalSeconds % 3600;
		const minutes = Math.floor(rest / 60);
		const seconds = rest % 60;

		return [
			...String(hours).split('').map(Number),
			...String(minutes).padStart(2, '0').split('').map(Number),
			...String(seconds).padStart(2, '0').split('').map(Number)
		];
	};

	const countdown = createCountdown({
		initial: untrack(() => value),
		onDone: () => onDone?.()
	});
	const hms = $derived(parseTime(countdown.remaining));

	// 分与秒各占两位, 冒号插在它们前面; 位数不够时 (小时的位数可变) 索引会落在范围外, 自然跳过
	const separators = $derived.by(() => {
		const length = hms.length;
		return [length - 4, length - 2].filter((index) => index >= 0);
	});
</script>

<div class="countdown">
	<DigitRow values={DIGITS} digits={hms} {separators} direction={-1} />
</div>

<style>
	.countdown {
		display: flex;
		align-items: center;
		gap: 0;
		height: 40px;
		padding: 4px;
	}
</style>
