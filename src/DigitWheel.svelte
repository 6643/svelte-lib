<script lang="ts">
	import { untrack } from 'svelte';
	import { prefersReducedMotion, Spring } from 'svelte/motion';

	type Props = {
		// 轮盘里的取值序列
		values: number[];
		// 当前应显示的值
		value: number;
		// <0 表示向下滚动, 其余向上
		direction?: number;
	};

	let { values, value, direction }: Props = $props();

	const digits = $derived(values.length > 0 ? values : [0]);
	const targetIndex = $derived(Math.max(0, digits.indexOf(value)));
	const signedDirection = $derived(direction !== undefined && direction < 0 ? -1 : 1);

	const normalizeIndex = (index: number, length: number): number =>
		((index % length) + length) % length;

	// 方向决定跨圈数: 向上取上整数圈, 向下取下整数圈, 视觉上就是数字连续滚动
	const resolveTarget = (current: number, target: number, length: number, sign: number): number =>
		sign < 0
			? target + Math.floor((current - target) / length) * length
			: target + Math.ceil((current - target) / length) * length;

	// 位置由 Spring 逐帧逼近 target, 不再自己排 setTimeout
	// stiffness/damping 取源码手写弹簧的 SPRING 系数 (0.18) 与临界阻尼,
	// 单帧推进比例与原来的 `position += delta * 0.18` 等价
	const spring = new Spring(untrack(() => targetIndex), {
		stiffness: 0.18,
		damping: 1,
		precision: 0.001
	});
	let started = false;

	$effect(() => {
		const next = targetIndex;
		const length = digits.length;
		const sign = signedDirection;
		const instant = prefersReducedMotion.current;
		// 读当前位置但不订阅, 否则每帧都会重算 target
		const current = untrack(() => spring.current);

		// 首帧直接对齐, 避免初始滚动
		if (!started) {
			started = true;
			void spring.set(next, { instant: true });
			return;
		}

		void spring.set(resolveTarget(current, next, length, sign), { instant });
	});

	const position = $derived(spring.current);
	const currentIndex = $derived(Math.floor(position));
	const offset = $derived(`${100 * (position - currentIndex)}%`);
</script>

<div class="digit-wheel">
	<div class="digits" style:--offset={offset}>
		<strong class="next" aria-hidden="true">
			{digits[normalizeIndex(currentIndex + 1, digits.length)]}
		</strong>
		<strong class="current">
			{digits[normalizeIndex(currentIndex, digits.length)]}
		</strong>
	</div>
</div>

<style>
	.digit-wheel {
		position: relative;
		display: inline-block;
		width: 0.68em;
		height: 1.08em;
		overflow: hidden;
		text-align: center;
	}

	.digits {
		position: absolute;
		inset: 0;
		transform: translateY(var(--offset));
		will-change: transform;
	}

	.digits strong {
		position: absolute;
		left: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		font-weight: 400;
		font-variant-numeric: tabular-nums;
		color: var(--raised-fg);
		font-size: 1rem;
		line-height: 1;
		letter-spacing: 0;
	}

	.current {
		top: 0;
	}

	.next {
		top: -100%;
		user-select: none;
	}
</style>
