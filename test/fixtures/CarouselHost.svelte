<script lang="ts">
	import { untrack } from 'svelte';
	import Carousel from '../../src/Carousel.svelte';

	type Props = { imgs: string[]; initial?: number };
	let { imgs, initial = 0 }: Props = $props();

	// 受控宿主: index 存在上层, 用 bind:index 与组件双向绑定
	let index = $state(untrack(() => initial));
</script>

<Carousel {imgs} bind:index />
<output class="index">{index}</output>
