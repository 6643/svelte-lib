<script lang="ts">
	import type { Snippet } from 'svelte';
	import { tick, untrack } from 'svelte';
	import { cubicOut, linear } from 'svelte/easing';
	import { prefersReducedMotion, Tween } from 'svelte/motion';
	import { createTween } from './hooks/createTween.svelte.ts';
	import { roundCss } from './utils/round.ts';
	import Button from './Button.svelte';
	import SvgIcon from './SvgIcon.svelte';
	import { icon_menu } from './svgicons.ts';
	import { useKeepScroll } from './hooks/useKeepScroll.ts';
	import { currentPath, panelScrollKey, readTabIndex, writeTabIndex } from './tabState.svelte.ts';
	import { createDebounce } from './utils/createDebounce.ts';
	import { useResize } from './hooks/useResize.ts';
	import { computeNavMetrics, measurePanels } from './tab/navMetrics.ts';
	import TabPanel from './tab/Panel.svelte';
	import type { TabDirection, TabItem, TabMode } from './tabTypes.ts';

	const DEFAULT_KEY: Record<TabMode, string> = {
		bottom: 'app.tab',
		top: 'top.tab',
		left: 'left.tab',
		menu: 'scroll.tab',
		nav: 'nav.tab'
	};

	// 左/中/Tab 的导航项高度与间距 (源实现里的硬编码常量)
	const LEFT_ITEM_HEIGHT = 68;
	const NAV_ITEM_H = 48;
	const NAV_GAP = 4;

	// 点击导航项后 smooth 滚动的兜底等待时长; 正常情况由 scrollend 事件提前结束.
	// 与源实现的 500ms 一致: 浏览器 smooth 滚动时长由距离决定, 这里只是上限.
	const CLICK_SCROLL_SETTLE_MS = 500;

	type Props = {
		// 外观, 对应源实现的五个组件
		mode: TabMode;
		items: TabItem[];
		// 面板内容, 参数是当前项索引
		panel: Snippet<[number]>;
		// localStorage 里的存储键, 同页面多组 tab 需要区分
		storageKey?: string;
		// 切换到新项后回调 (点当前项不触发)
		onchange?: (index: number) => void;
	};

	let { mode, items, panel, storageKey = DEFAULT_KEY[mode], onchange }: Props = $props();

	// 面板与指示条的动画时长, 与源码 CSS 的 512ms 对齐
	const ANIMATION_MS = 512;

	let activeIndex = $state(untrack(() => readTabIndex(storageKey)));
	let mainEl = $state<HTMLElement>();
	let navEl = $state<HTMLElement>();

	// ── bottom / top: 左右滑动切换 ──
	let direction = $state<TabDirection>('right');
	// bottom 的六边形指示器每次切换转一圈, 方向跟随左右
	let spin = $state(0);

	// ── left: 上下滑动切换 ──
	let goingUp = $state(false);
	let leftTop = $state(LEFT_ITEM_HEIGHT * untrack(() => activeIndex));

	// ── menu: 指示条按当前项的实际尺寸定位 ──
	let indicator = $state({ left: 0, width: 0 });
	let listEl = $state<HTMLElement>();

	// ── nav: 滚动联动的高亮区间 ──
	let actives = $state<boolean[]>([]);
	let navTop = $state(0);
	let navHeight = $state(0);
	// 点击后到平滑滚动结束之间忽略滚动计算, 让 smooth 滚动先走完
	let clickIndex = -1;
	let clickSettleTimer: ReturnType<typeof setTimeout> | undefined;

	// 指示条的位置/尺寸/旋转都是数值, 由 Tween 补间后写回 CSS 变量;
	// 这些属性的 transition 已从 CSS 删除, 时长只有这一处定义
	const indexTween = createTween(() => activeIndex, { duration: ANIMATION_MS, easing: linear });
	// top 的指示条源码用的是 ease, 单独一条补间, 避免把 bottom 的 linear 语义改掉
	const topIndexTween = createTween(() => activeIndex, { duration: ANIMATION_MS });
	const spinTween = createTween(() => spin, { duration: ANIMATION_MS, easing: linear });
	const leftTopTween = createTween(() => leftTop, { duration: ANIMATION_MS });
	const navTopTween = createTween(() => navTop, { duration: ANIMATION_MS });
	const navHeightTween = createTween(() => navHeight, { duration: ANIMATION_MS });
	const indicatorLeftTween = createTween(() => indicator.left, { duration: ANIMATION_MS });
	const indicatorWidthTween = createTween(() => indicator.width, { duration: ANIMATION_MS });


	// 面板入场进度: 0 -> 1, 位移方向由 data-direction 在 CSS 里派生.
	// 不用 transition: 指令, 因为它的驱动是 WAAPI (element.animate), 单测环境不结算帧,
	// 且卸载时 cancel() 会抛未处理的 AbortError.
	const panelProgress = new Tween(1, { duration: 0, easing: cubicOut });

	$effect(() => {
		// 读 activeIndex: 换 tab 时重播入场
		void activeIndex;
		const duration = prefersReducedMotion.current ? 0 : ANIMATION_MS;

		// duration 0 让上一段补间就地中止, 再从头起补
		void panelProgress.set(0, { duration: 0 }).then(() => panelProgress.set(1, { duration }));
	});

	const notify = (index: number) => {
		writeTabIndex(storageKey, index);
		onchange?.(index);
	};

	// 切换索引. 各形态的守卫/副作用与源实现逐条对应:
	// bottom/top/left/menu 点当前项是 no-op; nav 允许重复点击 (用来重新滚到该面板).
	const toIndex = (index: number) => {
		switch (mode) {
			case 'bottom': {
				if (index === activeIndex) return;
				direction = index < activeIndex ? 'left' : 'right';
				spin += direction === 'left' ? -360 : 360;
				break;
			}
			case 'top': {
				if (index === activeIndex) return;
				direction = index < activeIndex ? 'left' : 'right';
				break;
			}
			case 'left': {
				if (!navEl || index === activeIndex) return;
				// 侧栏项多时先把目标项滚到中间, 再移动指示条
				(navEl.children[index] as HTMLElement | undefined)?.scrollIntoView({
					behavior: 'smooth',
					block: 'center'
				});
				leftTop = LEFT_ITEM_HEIGHT * index;
				goingUp = index > activeIndex;
				break;
			}
			case 'menu': {
				if (!listEl) return;
				const child = listEl.children[index] as HTMLElement | undefined;
				if (!child || index === activeIndex) return;
				indicator = { left: child.offsetLeft, width: child.offsetWidth };
				break;
			}
			case 'nav': {
				if (!navEl || !mainEl) return;
				scrollToPanel(index);
				break;
			}
		}

		activeIndex = index;
		notify(index);
	};

	// ── menu 的指示条测量 ──

	const measureIndicator = () => {
		const child = listEl?.children[activeIndex] as HTMLElement | undefined;
		if (!child) return;
		indicator = { left: child.offsetLeft, width: child.offsetWidth };
	};

	// 挂载后先等一帧 (字体与布局稳定) 再量; 之后宽度变化由 ResizeObserver 触发重量.
	$effect(() => {
		if (mode !== 'menu' || !listEl) return;

		let disposed = false;
		void tick().then(() => {
			if (!disposed) measureIndicator();
		});

		return () => {
			disposed = true;
		};
	});

	// 列表项宽度/缩放变化时重新量, 替代源实现里"只在首帧量一次"的近似
	const resizeMeasure = useResize(() => measureIndicator());

	// ── nav 的可见比例计算 ──

	// 量一次当前可见性, 据此更新高亮与指示条.
	const compute = () => {
		if (!mainEl) return;

		const box = mainEl.getBoundingClientRect();
		const panels = Array.from(mainEl.children).map((child) => {
			const rect = child.getBoundingClientRect();
			return { top: rect.top, bottom: rect.bottom, height: rect.height };
		});

		const visibility = measurePanels(panels, box);
		const metrics = computeNavMetrics(visibility, {
			itemHeight: NAV_ITEM_H,
			gap: NAV_GAP,
			navCount: navEl?.children.length ?? 0,
			clickIndex
		});
		// 全部面板都不可见时保留上一次的值, 避免指示条闪到 0
		if (!metrics) return;

		actives = metrics.actives;
		navTop = metrics.top;
		navHeight = metrics.height;
	};

	const scrollToPanel = (index: number) => {
		if (!navEl || !mainEl) return;

		clickIndex = index;
		(navEl.children[index] as HTMLElement | undefined)?.scrollIntoView({
			behavior: 'smooth',
			block: 'center'
		});
		(mainEl.children[index] as HTMLElement | undefined)?.scrollIntoView();
		compute();

		// 兜底: 不支持 scrollend 的浏览器靠定时器解锁
		clearTimeout(clickSettleTimer);
		clickSettleTimer = setTimeout(releaseClickLock, CLICK_SCROLL_SETTLE_MS);
	};

	// 平滑滚动结束: 只解锁, 不重算.
	//
	// 点击态下的位置由 `clickIndex` 直接给出, 与最终滚动位置等价;
	// 这里若按当时的几何重算, 滚动动画尚未落到最终帧的浏览器会读到中间值,
	// 让指示条先跳一下再回来. 解锁后的下一次用户滚动自会重算.
	const releaseClickLock = () => {
		clearTimeout(clickSettleTimer);
		clickSettleTimer = undefined;
		clickIndex = -1;
	};

	const onScroll = createDebounce(() => {
		if (clickIndex >= 0) return;
		compute();
	}, 32);

	// 平滑滚动结束: 现代浏览器派发 scrollend, 比定时器更早也更准; 定时器只做兜底
	$effect(() => {
		const main = mainEl;
		if (mode !== 'nav' || !main) return;

		main.addEventListener('scrollend', releaseClickLock);
		return () => {
			main.removeEventListener('scrollend', releaseClickLock);
			clearTimeout(clickSettleTimer);
			clickSettleTimer = undefined;
		};
	});

	// 首帧后把上次索引滚进视野, 与源实现的 onSettled + queueMicrotask 等价
	$effect(() => {
		if (mode !== 'nav') return;

		queueMicrotask(() => toIndex(untrack(() => readTabIndex(storageKey))));

		return () => onScroll.cancel();
	});

	// 面板滚动位置按 storageKey 记忆; nav 是整块记住, 其余按项分开.
	// 在调用点读 activeIndex: 换 tab 时派生新附件, 旧面板的记忆随之重挂.
	const keepScroll = $derived(
		useKeepScroll(
			currentPath(),
			mode === 'nav' ? storageKey : panelScrollKey(storageKey, activeIndex)
		)
	);
</script>

<div
	class="{mode}-tab"
	data-mode={mode}
	style:--left={mode === 'menu' ? roundCss(indicatorLeftTween.current) : undefined}
	style:--width={mode === 'menu' ? roundCss(indicatorWidthTween.current) : undefined}
>
	{#if mode === 'bottom'}
		{@render singlePanel(direction)}
		{@render iconNav('len')}
	{:else if mode === 'top'}
		{@render iconNav('count')}
		{@render singlePanel(direction)}
	{:else if mode === 'left'}
		{@render textNav(goingUp ? 'up' : 'down')}
	{:else if mode === 'menu'}
		{@render menuNav()}
	{:else}
		{@render scrollNav()}
	{/if}
</div>

{#snippet iconTab(item: TabItem, index: number)}
	<button
		type="button"
		class:active={index === activeIndex}
		aria-label={item.name ?? `tab ${index + 1}`}
		role="tab"
		aria-selected={index === activeIndex}
		onclick={() => toIndex(index)}
	>
		{#if item.icon}<SvgIcon size={24} svgPaths={item.icon} />{/if}
		{#if item.name}<span>{item.name}</span>{/if}
	</button>
{/snippet}

{#snippet textTab(item: TabItem, index: number, active: boolean)}
	<button
		type="button"
		class:active
		role="tab"
		aria-selected={active}
		onclick={() => toIndex(index)}
	>
		{item.name}
	</button>
{/snippet}

{#snippet singlePanel(dir: TabDirection | undefined)}
	{#if items[activeIndex]}
		<TabPanel
			kind="single"
			count={items.length}
			{activeIndex}
			direction={dir}
			progress={panelProgress.current}
			{panel}
			keepScroll={keepScroll}
			bind:element={mainEl}
		/>
	{/if}
{/snippet}

{#snippet iconNav(which: 'len' | 'count')}
	<nav
		class="tab-nav"
		style:--len={which === 'len' ? items.length : undefined}
		style:--count={which === 'count' ? items.length : undefined}
		style:--index={roundCss((which === 'count' ? topIndexTween : indexTween).current)}
		style:--spin={which === 'len' ? roundCss(spinTween.current) : undefined}
	>
		{#each items as item, index (index)}
			{@render iconTab(item, index)}
		{/each}
	</nav>
{/snippet}

{#snippet textNav(dir: TabDirection)}
	<nav bind:this={navEl} class="tab-nav" style:--top={roundCss(leftTopTween.current)}>
		{#each items as item, index (index)}
			{@render textTab(item, index, index === activeIndex)}
		{/each}
	</nav>
	{@render singlePanel(dir)}
{/snippet}

{#snippet menuNav()}
	<nav>
		<div bind:this={listEl} class="nav-list" {@attach resizeMeasure}>
			{#each items as item, index (index)}
				{@render textTab(item, index, index === activeIndex)}
			{/each}
		</div>
		<Button mode="icon" icon={icon_menu} ariaLabel="Menu" />
	</nav>
	{@render singlePanel(undefined)}
{/snippet}

{#snippet scrollNav()}
	<nav
		bind:this={navEl}
		class="tab-nav"
		style:--top={roundCss(navTopTween.current)}
		style:--height={roundCss(navHeightTween.current)}
	>
		{#each items as item, index (index)}
			{@render textTab(item, index, !!actives[index])}
		{/each}
	</nav>

	<TabPanel
		kind="list"
		count={items.length}
		{activeIndex}
		{panel}
		keepScroll={keepScroll}
		onscroll={onScroll}
		bind:element={mainEl}
	/>
{/snippet}


<style>
	/* ── 公共面板 ── */

	.bottom-tab,
	.top-tab,
	.left-tab,
	.menu-tab,
	.nav-tab {
		width: 100%;
		height: 100%;
		overflow: hidden;
	}

	/* ── bottom ── */

	.bottom-tab {
		display: grid;
		grid-template-rows: 1fr 64px;
	}

	.bottom-tab > .tab-nav {
		background-color: var(--raised-bg);
		user-select: none;
		width: 100%;
		height: 64px;
		position: relative;
		display: grid;
		grid-template-columns: repeat(var(--len), 1fr);
		box-shadow: 0 -4px 4px -4px var(--inset-bg);
	}

	/* 六边形背景指示器 */
	.bottom-tab > .tab-nav::before {
		content: '';
		position: absolute;
		bottom: 0;
		left: calc(100% / var(--len) * var(--index, 0));
		height: 64px;
		width: calc(100% / var(--len));
		z-index: 0;
		--svg: url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 140 140'><path d='M62 10.619a16 16 0 0 1 16 0l39.426 22.762a16 16 0 0 1 8 13.856v45.525a16 16 0 0 1-8 13.856L78 129.381a16 16 0 0 1-16 0l-39.426-22.762a16 16 0 0 1-8-13.856V47.238a16 16 0 0 1 8-13.856' /></svg>");
		mask: var(--svg) no-repeat center;
		background-color: var(--accent-color);
		opacity: 0.2;
		transform: rotate(calc(var(--spin, 0) * 1deg));
		will-change: left, transform;
	}

	/* 线条指示器 */
	.bottom-tab > .tab-nav::after {
		content: '';
		position: absolute;
		top: 0;
		left: calc(100% / var(--len) * var(--index, 0));
		width: calc(100% / var(--len));
		height: 2px;
		z-index: 2;
		background-color: var(--accent-color);
		will-change: left;
	}

	.bottom-tab > .tab-nav > button {
		appearance: none;
		background: none;
		border: 0;
		z-index: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
		color: var(--raised-fg);
		cursor: pointer;
		font: inherit;
		transition: color 200ms ease;
	}

	.bottom-tab > .tab-nav > button.active {
		color: var(--accent-color);
	}

	/* ── top ── */

	.top-tab {
		display: grid;
		grid-template-rows: auto 1fr;
		gap: 4px;
	}

	.top-tab > .tab-nav {
		user-select: none;
		width: 100%;
		height: 48px;
		display: flex;
		position: relative;
		z-index: 100;
		box-shadow: 0 2px 4px var(--raised-bg);
		background-color: var(--inset-bg);
	}

	/* 线条指示器 */
	.top-tab > .tab-nav::before {
		content: '';
		position: absolute;
		bottom: 0;
		left: calc(100% / var(--count) * var(--index, 0));
		width: calc(100% / var(--count));
		height: 2px;
		background-color: var(--accent-color);
		will-change: left, width;
	}

	/* 滑块指示器 */
	.top-tab > .tab-nav::after {
		content: '';
		position: absolute;
		top: 0;
		bottom: 0;
		left: calc(100% / var(--count) * var(--index, 0));
		width: calc(100% / var(--count));
		background-color: var(--accent-color);
		opacity: 0.12;
		will-change: left, width;
	}

	.top-tab > .tab-nav > button {
		appearance: none;
		background: none;
		border: 0;
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		color: var(--raised-fg);
		cursor: pointer;
		font: inherit;
		/* 颜色反馈留在 CSS: 无状态, 也不是本组件的主动画 */
		transition: color 512ms ease;
	}

	.top-tab > .tab-nav > button.active {
		color: var(--accent-color);
	}

	/* ── left ── */

	.left-tab {
		display: grid;
		grid-template-columns: auto 1fr;
	}

	.left-tab > .tab-nav {
		user-select: none;
		width: auto;
		height: 100%;
		display: grid;
		grid-auto-rows: 64px;
		gap: 4px;
		background-color: var(--inset-bg);
		box-shadow: 4px 0 4px -4px var(--disabled-color);
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		position: relative;
	}

	.left-tab > .tab-nav::-webkit-scrollbar {
		display: none;
	}

	/* 滑动指示器 */
	.left-tab > .tab-nav::before {
		content: '';
		position: absolute;
		right: 0;
		top: calc(1px * var(--top, 0));
		width: 2px;
		height: 64px;
		background-color: var(--accent-color);
		will-change: top;
	}

	.left-tab > .tab-nav > button {
		appearance: none;
		border: 0;
		padding: 8px;
		background-color: var(--inset-bg);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--raised-fg);
		cursor: pointer;
		font: inherit;
		/* 颜色反馈留在 CSS */
		transition: color 512ms ease;
	}

	.left-tab > .tab-nav > button.active {
		color: var(--accent-color);
	}

	/* ── menu ── */

	.menu-tab {
		display: grid;
		grid-template-rows: auto 1fr;
		gap: 4px;
	}

	.menu-tab > nav {
		user-select: none;
		width: 100%;
		height: 48px;
		display: flex;
		align-items: center;
		position: relative;
		background-color: var(--inset-bg);
		box-shadow: 0 2px 4px var(--raised-bg);
	}

	.menu-tab > nav::-webkit-scrollbar {
		display: none;
	}

	.menu-tab > nav > .nav-list {
		flex: 1;
		min-width: 0;
		display: flex;
		overflow-x: auto;
		gap: 4px;
		position: relative;
		z-index: 1;
	}

	.menu-tab > nav > .nav-list::-webkit-scrollbar {
		display: none;
	}

	.menu-tab > nav > .nav-list > button {
		appearance: none;
		background: none;
		border: 0;
		padding: 4px 12px;
		white-space: nowrap;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--raised-fg);
		cursor: pointer;
		font: inherit;
		transition: color 200ms ease;
	}

	.menu-tab > nav > .nav-list > button.active {
		color: var(--accent-color);
	}

	/* 线条指示器 */
	.menu-tab > nav::before {
		content: '';
		position: absolute;
		bottom: 0;
		left: calc(1px * var(--left, 0));
		width: calc(1px * var(--width, 0));
		height: 2px;
		background-color: var(--accent-color);
		will-change: left, width;
	}

	/* 滑块指示器 */
	.menu-tab > nav::after {
		content: '';
		position: absolute;
		top: 0;
		bottom: 0;
		left: calc(1px * var(--left, 0));
		width: calc(1px * var(--width, 0));
		background-color: var(--accent-color);
		opacity: 0.12;
		will-change: left, width;
	}

	/* ── nav ── */

	.nav-tab {
		height: 100vh;
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 4px;
	}

	.nav-tab > .tab-nav {
		user-select: none;
		width: auto;
		height: 100vh;
		position: relative;
		display: grid;
		grid-auto-rows: 48px;
		gap: 4px;
		background-color: var(--inset-bg);
		box-shadow: 4px 0 4px -4px var(--disabled-color);
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		z-index: 100;
	}

	.nav-tab > .tab-nav::-webkit-scrollbar {
		display: none;
	}

	/* 线条指示器 */
	.nav-tab > .tab-nav::before {
		content: '';
		position: absolute;
		right: 0;
		top: calc(1px * var(--top, 0));
		width: 2px;
		height: calc(1px * var(--height, 48));
		background-color: var(--accent-color);
		z-index: 1;
		will-change: top, height;
	}

	/* 滑块指示器 */
	.nav-tab > .tab-nav::after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		top: calc(1px * var(--top, 0));
		height: calc(1px * var(--height, 48));
		background-color: var(--accent-color);
		opacity: 0.12;
		will-change: top, height;
	}

	.nav-tab > .tab-nav > button {
		appearance: none;
		border: 0;
		padding: 8px 16px;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--raised-fg);
		background: none;
		cursor: pointer;
		font: inherit;
		/* 颜色反馈留在 CSS */
		transition: color 512ms ease;
	}

	.nav-tab > .tab-nav > button.active {
		color: var(--accent-color);
		background-color: var(--inset-bg);
	}

	/* 面板是子组件 (tab/Panel.svelte) 的根元素, 因此用 :global 跨组件选择 */
	.nav-tab > :global(.panel) {
		height: 100vh;
	}

	.nav-tab > :global(.panel > div) {
		min-height: 200px;
	}
</style>
