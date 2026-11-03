<script lang="ts" generics="T">
	import { untrack } from 'svelte';
	import SortListBox from '../../src/SortListBox.svelte';

	type Props = {
		items: T[];
		// 传了就用 item 本身做键 (本 fixture 的 item 是字符串)
		useKey?: boolean;
		reorder?: (items: T[], oldIndex: number, newIndex: number) => void;
	};

	let { items, useKey, reorder }: Props = $props();

	let current = $state(untrack(() => items));

	// 允许测试从外部改写顺序
	$effect(() => {
		current = items;
	});
</script>

<div class="host">
	<SortListBox
		bind:items={current}
		key={useKey ? (item: T) => item : undefined}
		onreorder={(next, oldIndex, newIndex) => reorder?.(next, oldIndex, newIndex)}
	>
		{#snippet children(item: T)}
			<span class="label">{item}</span>
		{/snippet}
	</SortListBox>
	<output class="order">{current.join(',')}</output>
</div>
