<script lang="ts">
	import { untrack } from 'svelte';
	import { createTween } from '../../src/hooks/createTween.svelte.ts';

	let { initial = 0, duration = 512 }: { initial?: number; duration?: number } = $props();

	let target = $state(untrack(() => initial));
	// duration 只在首帧取值, 与组件里 "传常量时长" 的用法一致
	const tween = createTween(() => target, { duration: untrack(() => duration) });

	export const setTarget = (value: number): void => {
		target = value;
	};
</script>

<output class="target">{target}</output>
<output class="current">{tween.current.toFixed(3)}</output>
