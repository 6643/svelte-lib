<script lang="ts">
	import { untrack } from 'svelte';
	import { useScrollEnd } from '../../src/hooks/useScrollEnd.ts';
	import { useKeepScroll } from '../../src/hooks/useKeepScroll.ts';
	import { createLoad, type LoadMoreFn } from '../../src/hooks/createLoad.svelte.ts';
	import { useLoadMore } from '../../src/hooks/useLoadMore.ts';

	type Props = {
		mode: 'scrollEnd' | 'keepScroll' | 'load';
		hook?: (top: number) => void;
		page?: string;
		key?: string;
		more?: LoadMoreFn<string>;
		threshold?: number;
		scrollHeight?: number;
	};

	let {
		mode,
		hook,
		page = 'p',
		key = 'k',
		more,
		threshold,
		scrollHeight = 1000
	}: Props = $props();

	const noopMore: LoadMoreFn<string> = async () => false;
	const handle = createLoad(
		(page, args) => (untrack(() => more) ?? noopMore)(page, args),
		() => 'args',
	);
</script>

<div
	class="probe"
	style:height="100px"
	style:overflow="auto"
	{@attach useScrollEnd((top) => hook?.(top))}
	{@attach useKeepScroll(() => page, () => key)}
>
	<div style:height="{scrollHeight}px"></div>
</div>

{#if mode === 'load'}
	<div class="probe-panel" {@attach useLoadMore(handle, threshold)}></div>
	<button type="button" class="reset" onclick={() => handle.reset()}>reset</button>
	<span class="page">{handle.page}</span>
	<span class="has-more">{String(handle.hasMore)}</span>
{/if}
