<script lang="ts" generics="T">
	import { untrack } from 'svelte';
	import { createLoad, type LoadMoreFn } from './hooks/createLoad.svelte.ts';
	import { useLoadMore } from './hooks/useLoadMore.ts';

	type Props = {
		// 拉第 page 页; 返回 false 表示没有更多
		api: LoadMoreFn<T>;
		args?: T;
		threshold?: number;
	};

	let { api, args, threshold = 320 }: Props = $props();

	let el = $state<HTMLSpanElement>();

	// api 与 args 在调用点读取: 组件重建 (key 块) 才会换加载器, 与源实现一致
	const handle = createLoad<T>(
		(page, current) => api(page, current),
		() => untrack(() => args) as T,
	);

	// 重置到第 0 页; 内容不足一屏时会立刻拉第一页
	export const reset = (): void => handle.reset(el);

</script>

<span
	bind:this={el}
	class="load-more"
	{@attach useLoadMore(handle, threshold)}
	data-page={handle.page}
	data-has-more={handle.hasMore}
></span>
