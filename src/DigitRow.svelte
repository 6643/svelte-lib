<script lang="ts">
	import DigitWheel from './DigitWheel.svelte';

	type Props = {
		// 轮盘取值序列, 传给每一位 `DigitWheel`
		values: number[];
		// 要显示的每一位数字
		digits: number[];
		// 滚动方向: <0 向下, 其余向上
		direction?: number;
		// 需要在这些索引的位之前插一个冒号 (用来分隔时分秒)
		separators?: number[];
		// 冒号颜色变量, 缺省用 inset-fg
		separatorColor?: string;
	};

	let { values, digits, direction, separators = [], separatorColor }: Props = $props();

	// 索引集合用得比数组查找多, 这里换成 Set 避免每位都线性扫一遍
	const splitAt = $derived(new Set(separators));
</script>

<div class="digit-row" style:--separator-color={separatorColor}>
	{#each digits as digit, index (index)}
		{#if splitAt.has(index)}<span class="separator">:</span>{/if}
		<DigitWheel {values} value={digit} {direction} />
	{/each}
</div>

<style>
	/* 与源实现一致: 数字与冒号同排, 行高由 DigitWheel 的 em 高度撑开 */
	.digit-row {
		display: flex;
		align-items: center;
		gap: 0;
	}

	.separator {
		color: var(--separator-color, var(--inset-fg));
	}
</style>
