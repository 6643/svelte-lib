<script lang="ts">
	import { untrack, type Component } from 'svelte';
	import {
		ensureRouteState,
		hasActiveExactRoute,
		isFallbackRoutePath,
		isUnsupportedRoutePath,
		matchesExactRoute,
		normalizePathname,
		readLocation,
		registerRoute,
		unregisterRoute,
		warnRoute
	} from './route.svelte.ts';

	type Props = {
		// 静态路径, 只支持精确匹配与 `/*` 兜底
		path: string;
		component: Component<Record<string, never>>;
	};

	let { path, component: RouteComponent }: Props = $props();

	// path / component 只在挂载时读一次: 路由块的身份在生命周期内不变
	const rawPath = untrack(() => path);
	const fallback = isFallbackRoutePath(rawPath);
	const routePath = fallback ? rawPath : normalizePathname(rawPath);
	const unsupported = isUnsupportedRoutePath(rawPath);

	if (unsupported) warnRoute(`路径只支持静态字符串, 该块永不匹配: ${rawPath}`);

	// 挂上窗口状态机 (滚动恢复 + 链接拦截). 幂等, 无浏览器时是 no-op.
	ensureRouteState();

	// 同步注册 (写普通 Map): 注册必须早于任何兜底判据读取.
	// 条件渲染由调用方用 {#if} 表达: 没挂载就不注册, 兜底自然接手.
	const routeId = registerRoute({ path: routePath, fallback });

	// 卸载时注销. $effect 的清理与组件销毁同批执行, 保证兜底判据不会读到僵尸条目.
	$effect(() => () => unregisterRoute(routeId));

	// 依赖链: 注册表版本 / location -> 兜底判据
	const matched = $derived.by(() => {
		if (unsupported) return false;

		const pathname = readLocation().pathname;
		return fallback ? !hasActiveExactRoute(pathname) : matchesExactRoute(routePath, pathname);
	});
</script>

{#if matched}
	<RouteComponent />
{/if}
