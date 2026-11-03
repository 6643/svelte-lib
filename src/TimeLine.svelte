<script lang="ts">
	import SvgIcon from './SvgIcon.svelte';
	import { icon_expand_all, icon_unfold_less } from './svgicons.ts';

	type TimelineEntry = { time: number; info: string; url?: string };

	type Props = {
		title: string;
		// 事件列表, 时间戳按秒
		events: TimelineEntry[];
		visCount?: number;
	};

	let { title, events, visCount }: Props = $props();

	let expanded = $state(false);

	const visible = $derived(
		expanded ? events : events.slice(0, visCount ?? 3)
	);

	const toRecentTime = (timestamp: number): string => {
		const now = new Date();
		const dt = new Date(timestamp * 1000);
		const currentYear = now.getFullYear();
		const todayStart = new Date(currentYear, now.getMonth(), now.getDate(), 0, 0, 0, 0);
		const yesterdayStart = new Date(currentYear, now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
		const dtDay = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate(), 0, 0, 0, 0);

		const timePart = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
		const monthDay = `${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;

		if (dtDay.getTime() === todayStart.getTime()) return `今天 ${timePart}`;
		if (dtDay.getTime() === yesterdayStart.getTime()) return `昨天 ${timePart}`;
		if (dt.getFullYear() === currentYear) return `${monthDay} ${timePart}`;
		return `${String(dt.getFullYear()).slice(-2)}-${monthDay} ${timePart}`;
	};
</script>

<div class="time-line">
	<div>{title}</div>
	{#each visible as event (event)}
		{#if event.url}
			<a href={event.url}>
				<div class="item">
					<span></span>
					<div>
						<span>{toRecentTime(event.time)}</span>
						<div>{event.info}</div>
					</div>
				</div>
			</a>
		{:else}
			<div class="item">
				<span></span>
				<div>
					<span>{toRecentTime(event.time)}</span>
					<div>{event.info}</div>
				</div>
			</div>
		{/if}
	{/each}
	{#if events.length > events.slice(0, visCount ?? 3).length}
		<div class="toggle">
			<span></span>
			<button type="button" onclick={() => (expanded = !expanded)}>
				<span>{expanded ? '收起' : '展开'}</span>
				<SvgIcon color="var(--inset-fg)" svgPaths={expanded ? icon_unfold_less : icon_expand_all} />
			</button>
		</div>
	{/if}
</div>

<style>
	.time-line {
		background-color: var(--inset-bg);
	}

	.item {
		display: flex;
	}

	.item > div {
		padding-bottom: 8px;
	}

	.item > div > span {
		color: var(--inset-fg);
	}

	.item > span {
		display: block;
		width: 9px;
		margin-right: 8px;
		position: relative;
	}

	.item > span::before,
	.toggle > span::before {
		content: '';
		display: block;
		width: 1px;
		height: 100%;
		background-color: var(--inset-bg);
		position: absolute;
		left: 50%;
		transform: translateX(-50%);
		top: 8px;
	}

	.item > span::after,
	.toggle > span::after {
		content: '';
		display: block;
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background-color: var(--accent-color);
		position: absolute;
		left: 50%;
		transform: translateX(-50%);
		top: 8px;
	}

	.item:last-of-type > span::before {
		display: none;
	}

	.item:last-of-type > div {
		display: flex;
		align-items: center;
		--color: var(--inset-fg);
		color: var(--color);
	}

	.toggle {
		display: flex;
	}

	.toggle > span {
		display: block;
		width: 9px;
		margin-right: 8px;
		position: relative;
	}

	.toggle > button {
		background: none;
		border: 0;
		color: inherit;
		cursor: pointer;
		display: flex;
		align-items: center;
		font: inherit;
		gap: 4px;
		padding: 0 0 8px;
	}
</style>
