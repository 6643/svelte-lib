<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		children: Snippet;
		headerTitle?: string;
		headerActions?: Snippet;
		footerLeft?: string;
		footerRight?: Snippet;
	};

	let { children, headerTitle, headerActions, footerLeft, footerRight }: Props = $props();
</script>

<section class="block">
	<!-- 有标题或操作区时才渲染 header, 否则会留下一条 48px 高的空条 -->
	{#if headerTitle || headerActions}
		<div class="header">
			{#if headerTitle}
				<span>{headerTitle}</span>
			{/if}
			<span>{@render headerActions?.()}</span>
		</div>
	{/if}
	<div>{@render children()}</div>
	{#if footerLeft || footerRight}
		<div class="footer">
			<span>{footerLeft}</span>
			<span>{@render footerRight?.()}</span>
		</div>
	{/if}
</section>

<style>
	.block {
		display: flex;
		flex-direction: column;
		gap: 4px;
		user-select: none;
		color: var(--inset-fg);
		padding: 8px 0;
	}

	.block > div {
		overflow: hidden;
		background-color: var(--disabled-color);
	}

	.block > div:first-child {
		border-top-left-radius: 9px;
		border-top-right-radius: 9px;
	}

	.block > div:last-child {
		border-bottom-left-radius: 9px;
		border-bottom-right-radius: 9px;
	}

	.block > .header {
		width: 100%;
		min-height: 48px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 8px;
		gap: 8px;
	}

	.block > .header > :last-child {
		flex: 1;
		display: flex;
		align-items: center;
		gap: 4px;
		justify-content: end;
	}
</style>
