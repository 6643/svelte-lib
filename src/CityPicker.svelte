<script lang="ts">
	import type { Snippet } from 'svelte';
	import SvgIcon from './SvgIcon.svelte';
	import { icon_chevron_right } from './svgicons.ts';
	import { getCities, getCityPath, initCities, type City } from './cities.svelte.ts';

	type Props = {
		// 是否展开, 可 `bind:open`
		open?: boolean;
		// 城市表地址, 首次展开时拉取
		url: string;
		// 下钻到的行政区划码, 可 `bind:cityCode`
		cityCode?: number;
		banCodes?: number[];
		// 选中末级城市时回调; 展开状态由 open 双向绑定维护
		onselect?: (city: { code: number; names: string[] }) => void;
		children?: Snippet;
	};

	let {
		open = $bindable(false),
		url,
		cityCode = $bindable(0),
		banCodes,
		onselect,
		children
	}: Props = $props();

	// 行政区划码 < 100000 视为中间层, 点击只下钻不关闭
	const LEAF_CODE = 100000;

	// 首次展开且表为空时加载
	$effect(() => {
		if (open && url && getCities().length === 0) void initCities(url);
	});

	const banned = $derived(new Set(banCodes ?? []));
	const breadcrumb = $derived(getCityPath(cityCode));
	const options = $derived(
		getCities().filter((city) => city.parent === cityCode && !banned.has(city.code))
	);

	const pick = (city: City) => {
		cityCode = city.code;

		if (city.code < LEAF_CODE) return;

		open = false;
		onselect?.({
			code: city.code,
			names: getCityPath(city.code).map((item) => item.name)
		});
	};
</script>

{@render children?.()}

{#if open}
	<div class="city-picker">
		{@render nav()}
		{@render list()}
	</div>
{/if}

{#snippet crumb(label: string, code: number, active: boolean)}
	<button type="button" class="crumb" class:active onclick={() => (cityCode = code)}>
		{label}
	</button>
{/snippet}

{#snippet option(city: City)}
	<button type="button" class="option" onclick={() => pick(city)}>
		<span>{city.name}</span>
		{#if city.code < LEAF_CODE}
			<SvgIcon size={20} svgPaths={icon_chevron_right} />
		{/if}
	</button>
{/snippet}

{#snippet nav()}
	<nav>
		{@render crumb('全部', 0, false)}
		{#each breadcrumb as city (city.code)}
			<span class="chevron"><SvgIcon size={20} svgPaths={icon_chevron_right} /></span>
			{@render crumb(city.name, city.code, true)}
		{/each}
	</nav>
{/snippet}

{#snippet list()}
	<main>
		{#each options as city (city.code)}
			{@render option(city)}
		{/each}
	</main>
{/snippet}


<style>
	.city-picker {
		display: grid;
		grid-template-rows: auto 1fr;
	}

	.city-picker > nav {
		user-select: none;
		padding: 8px;
		height: 48px;
		display: flex;
		gap: 8px;
		align-items: center;
	}

	.city-picker > nav > .crumb {
		background-color: var(--inset-bg);
		border: 0;
		color: inherit;
		cursor: pointer;
		font: inherit;
		padding: 4px 8px;
	}

	.city-picker > nav > .crumb.active {
		color: var(--inset-bg);
		background-color: var(--accent-color);
	}

	.city-picker > nav > .chevron {
		color: var(--inset-fg);
		font-size: smaller;
	}

	.city-picker > main {
		user-select: none;
		outline: none;
		overflow-y: auto;
		padding: 8px;
		scroll-snap-type: y mandatory;
	}

	.city-picker > main > .option {
		background-color: var(--inset-bg);
		border: 0;
		color: inherit;
		cursor: pointer;
		font: inherit;
		margin-bottom: 4px;
		display: flex;
		width: 100%;
		justify-content: space-between;
		align-items: center;
		scroll-snap-align: start;
	}
</style>
