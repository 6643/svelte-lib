<script lang="ts">
	import Route from '../../src/Route.svelte';
	import RouteExact from './RouteExact.svelte';
	import RouteFallback from './RouteFallback.svelte';
	import RouteGated from './RouteGated.svelte';

	type Props = {
		// 精确块的路径
		path: string;
		// 精确块是否挂载
		mounted?: boolean;
		// 是否挂兜底块
		withFallback?: boolean;
		// 是否额外挂一个同路径的受控块
		withGated?: boolean;
		// 受控块是否挂载
		gated?: boolean;
	};

	let { path, mounted = true, withFallback = true, withGated = false, gated }: Props = $props();
</script>

{#if mounted}
	<Route {path} component={RouteExact} />
{/if}
{#if withGated && gated}
	<Route {path} component={RouteGated} />
{/if}
{#if withFallback}
	<Route path="/*" component={RouteFallback} />
{/if}
