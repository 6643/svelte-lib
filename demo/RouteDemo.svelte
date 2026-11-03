<script lang="ts">
	import Route from '../src/Route.svelte';
	import RouteDemoHome from './RouteDemoHome.svelte';
	import RouteDemoAbout from './RouteDemoAbout.svelte';
	import RouteDemoNotFound from './RouteDemoNotFound.svelte';
	import { getRouteBackPath, readLocation } from '../src/route.svelte.ts';

	// 读 readLocation 即订阅导航: 路径变化的每次渲染都会重跑.
	// getRouteBackPath() 读的是 history.state (非 rune), 必须显式依赖 pathname 才能重算.
	const pathname = $derived(readLocation().pathname);
	const backPath = $derived.by(() => {
		void pathname;
		return getRouteBackPath() ?? '—';
	});
</script>

<div class="route-demo">
	<nav>
		<!-- 站内链接由路由的文档级拦截接管, 无需 onclick -->
		<a href="/">首页</a>
		<a href="/about">关于</a>
		<a href="/nowhere">不存在的页</a>
		<span class="current">当前: {pathname || '/'}</span>
		<span class="back">返回: {backPath}</span>
	</nav>
	<main>
		<Route path="/" component={RouteDemoHome} />
		<Route path="/about" component={RouteDemoAbout} />
		<Route path="/*" component={RouteDemoNotFound} />
	</main>
</div>

<style>
	.route-demo {
		display: grid;
		gap: 8px;
	}

	nav {
		display: flex;
		gap: 12px;
		align-items: center;
		font-size: 14px;
	}

	.current,
	.back {
		color: var(--inset-fg);
	}
</style>
