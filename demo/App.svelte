<script lang="ts">
	// 演示站: 分组挂载全部组件, 供人工目测. 数据全部内联, 不依赖网络.
	// 组件用 $bindable 双向绑定: 这里声明 $state, 子组件用 bind:xxx 读写.
	import {
		AccentSelector,
		AvatarImage,
		Block,
		Button,
		Card,
		Carousel,
		CenterBox,
		CityPicker,
		CountDown,
		Counter,
		DigitWheel,
		Expand,
		FlexBox,
		GridBox,
		ImagePlayer,
		Input,
		ListBox,
		LoadMore,
		Modal,
		SortListBox,
		StackBox,
		Tab,
		ThemeSwitch,
		TimeLine,
		TryCatch,
		SvgIcon,
		createTry,
		icon_add,
		icon_check_circle,
		icon_dark_mode,
		icon_face,
		icon_favorite,
		icon_home,
		icon_light_mode,
		icon_palette,
		icon_person,
		icon_search,
		icon_settings,
		icon_star,
		theme,
		type TabItem
	} from '#lib';
	import RouteDemo from './RouteDemo.svelte';

	// 演示 TryCatch: 一个必然失败的调用
	const probe = createTry();

	const icons = [
		icon_add,
		icon_search,
		icon_home,
		icon_settings,
		icon_star,
		icon_favorite,
		icon_face,
		icon_person,
		icon_palette,
		icon_check_circle,
		icon_light_mode,
		icon_dark_mode
	];

	const tabItems: TabItem[] = [
		{ name: '首页', icon: icon_home },
		{ name: '搜索', icon: icon_search },
		{ name: '我的', icon: icon_person }
	];

	const wheels = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
	const now = Math.floor(Date.now() / 1000);
	const events = [
		{ time: now - 60, info: '一分钟前' },
		{ time: now - 3600, info: '一小时前' },
		{ time: now - 86400, info: '昨天' },
		{ time: now - 86400 * 5, info: '五天前' },
		{ time: now - 86400 * 40, info: '四十天前' }
	];
	// CityPicker 的城市表是 "parent,code,name" 逐行文本; 演示用内联 data URL, 打开时由组件自行拉取
	const cityCsv = [
		'0,1000,广东',
		'0,2000,浙江',
		'1000,1100,广州',
		'1000,1200,深圳',
		'1100,100101,天河',
		'1100,100102,越秀',
		'1200,100201,南山',
		'2000,2100,杭州',
		'2100,100301,西湖'
	].join('\n');
	const cityUrl = `data:text/csv;charset=utf-8,${encodeURIComponent(cityCsv)}`;

	const words = ['一', '二', '三', '四', '五', '六'];
	const colors = ['#1976d2', '#388e3c', '#c2185b'];
	const images = colors.map(
		(color) =>
			`data:image/svg+xml;utf8,${encodeURIComponent(
				`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="${color}"/><text x="160" y="100" font-size="28" fill="#fff" text-anchor="middle">${color}</text></svg>`
			)}`
	);
	const listItems = Array.from({ length: 40 }, (_, index) => `条目 ${index}`);

	let modal = $state<'bottom' | 'top' | 'left' | 'right' | null>(null);
	let pickerOpen = $state(false);
	let listIndex = $state(0);
	let carouselIndex = $state(0);
	let sortItems = $state(['甲', '乙', '丙', '丁']);
	let text = $state('');
	let bio = $state('这是一段简介文本');
	let password = $state('');
	let email = $state('');
	let phone = $state('');
	let range = $state(30);
	let number = $state(5);
	let counter = $state(5);
	let wheel = $state(3);
	let countdown = $state(90);
	let checkA = $state(true);
	let checkB = $state(false);
	let radio = $state('a');
	let loadHandle = $state<{ reset: () => void }>();

	// 触底加载示例的 api: 返回是否还有下一页
	let loadedPages = $state<number[]>([]);
	const loadPage = async (page: number): Promise<boolean> => {
		await new Promise((resolve) => setTimeout(resolve, 300));
		loadedPages = [...loadedPages, page];
		return page < 2;
	};
</script>

<main>
	<header class="toolbar">
		<strong>svelte-components demo</strong>
		<span>主题: {theme.resolved}</span>
		<ThemeSwitch />
		<AccentSelector />
	</header>

	<section>
		<h2>Buttons</h2>
		<FlexBox gap={12} wrap="wrap" ai="center">
			<Button mode="filled" text="Filled" onclick={() => {}} />
			<Button mode="outlined" text="Outlined" onclick={() => {}} />
			<Button mode="text" text="Text" icon={icon_add} onclick={() => {}} />
			<Button mode="icon" icon={icon_star} ariaLabel="Favorite" onclick={() => {}} />
			<Button mode="filled" text="禁用" disabled onclick={() => {}} />
		</FlexBox>
	</section>

	<section>
		<h2>Icons</h2>
		<FlexBox gap={12} wrap="wrap" ai="center">
			{#each icons as path, index (index)}
				<SvgIcon svgPaths={path} size={24} />
			{/each}
		</FlexBox>
	</section>

	<section>
		<h2>Layout</h2>
		<GridBox columns="1fr 1fr" gap={12}>
			<Card>Card 内容</Card>
			<div class="center-host">
				<CenterBox>CenterBox</CenterBox>
			</div>
			<StackBox pos={[{ x: 0, y: 0 }, { x: 20, y: 20 }]}>
				<span>StackBox 1</span>
				<span>StackBox 2</span>
			</StackBox>
			<FlexBox dir="column" gap={6}>
				<span>FlexBox 1</span>
				<span>FlexBox 2</span>
			</FlexBox>
		</GridBox>

		<Block headerTitle="Block 标题" footerLeft="底部左侧">
			{#snippet headerActions()}
				<Button mode="text" text="动作" onclick={() => {}} />
			{/snippet}
			<p>Block 正文</p>
		</Block>
	</section>

	<section>
		<h2>Input</h2>
		<GridBox columns="1fr 1fr" gap={12}>
			<Input mode="text" label="文本" bind:value={text} />
			<Input mode="textarea" label="多行" row={3} bind:value={bio} />
			<Input mode="password" label="密码" bind:value={password} />
			<Input mode="email" label="邮箱" bind:value={email} />
			<Input mode="tel" label="电话" bind:value={phone} />
			<Input mode="captcha" label="验证码" />
			<Input mode="number" label="数字" bind:value={number} min={0} max={10} />
			<Input mode="range" label="范围" bind:value={range} min={0} max={100} unit="%" />
			<Input mode="checkbox" label="复选 A" bind:checked={checkA} />
			<Input mode="checkbox" label="复选 B" bind:checked={checkB} />
			<Input mode="radio" label="单选 A" value="a" name="demo" bind:group={radio} />
			<Input mode="radio" label="单选 B" value="b" name="demo" bind:group={radio} />
		</GridBox>
	</section>

	<section>
		<h2>Display</h2>
		<FlexBox gap={12} wrap="wrap" ai="center">
			<AvatarImage src="" size={48} color="blue" />
			<AvatarImage src="" size={48} color="pink" />
			<Counter bind:value={counter} min={0} max={10} />
			<DigitWheel values={wheels} value={wheel} />
			<CountDown value={countdown} onDone={() => (countdown = 90)} />
		</FlexBox>

		<FlexBox gap={12} wrap="wrap" ai="flex-start">
			<Carousel imgs={images} bind:index={carouselIndex} />
			<ImagePlayer duration={2000} height={180} imgs={words} />
		</FlexBox>

		<TimeLine title="时间线" events={events} visCount={3} />

		<GridBox columns="1fr 1fr" gap={12}>
			<div class="list-host">
				<ListBox items={listItems} bind:index={listIndex}>
					{#snippet children(item, i)}
						<span>{String(item)} #{i}</span>
					{/snippet}
				</ListBox>
			</div>

			<div class="list-host">
				<SortListBox bind:items={sortItems}>
					{#snippet children(item)}
						<span>{String(item)}</span>
					{/snippet}
				</SortListBox>
			</div>
		</GridBox>
	</section>

	<section>
		<h2>Tabs</h2>
		{#snippet tabPanel(index: number)}
			<p>面板 {index}</p>
		{/snippet}
		<Tab mode="bottom" items={tabItems} panel={tabPanel} storageKey="demo.bottom" />
		<Tab mode="top" items={tabItems} panel={tabPanel} storageKey="demo.top" />
		<Tab mode="left" items={tabItems} panel={tabPanel} storageKey="demo.left" />
		<Tab mode="menu" items={tabItems} panel={tabPanel} storageKey="demo.menu" />
		<!-- nav 高度是 100vh (与源实现一致), 演示给一个 400px 定尺宿主 -->
		<div class="nav-host">
			<Tab mode="nav" items={tabItems} panel={tabPanel} storageKey="demo.nav" />
		</div>
	</section>

	<section>
		<h2>Interaction</h2>
		<Expand title="可展开项">
			<p>展开后的内容</p>
		</Expand>

		<FlexBox gap={12} wrap="wrap">
			<Button mode="text" text="底部弹层" onclick={() => (modal = 'bottom')} />
			<Button mode="text" text="顶部弹层" onclick={() => (modal = 'top')} />
			<Button mode="text" text="左侧弹层" onclick={() => (modal = 'left')} />
			<Button mode="text" text="右侧弹层" onclick={() => (modal = 'right')} />
			<Button mode="text" text="城市选择" onclick={() => (pickerOpen = true)} />
		</FlexBox>

		<Modal mode="bottom" open={modal === 'bottom'} onClose={() => (modal = null)} height="240px">
			<p>底部弹层内容</p>
		</Modal>
		<Modal mode="top" open={modal === 'top'} onClose={() => (modal = null)}>
			<p>顶部弹层内容</p>
		</Modal>
		<Modal mode="left" open={modal === 'left'} onClose={() => (modal = null)} width="280px">
			<p>左侧弹层内容</p>
		</Modal>
		<Modal mode="right" open={modal === 'right'} onClose={() => (modal = null)} width="280px">
			<p>右侧弹层内容</p>
		</Modal>

		<!-- 城市表由 initCities 预加载 (内联 data URL), 打开后即可点选 -->
		<CityPicker bind:open={pickerOpen} url={cityUrl} />
	</section>

	<section>
		<h2>Functional</h2>
		<!-- 与源实现一致: useScrollEnd 把 scroll 监听挂在哨兵 span 自身, 页面/父容器滚动都不会
		     冒泡到它, 所以只能由使用方显式调 reset() 起步, 且 reset 会把页码复位到 0.
		     不要在挂载期自动 reset: 附件跑在 effect 里, 读 page 又写 page 会死循环. -->
		<p>LoadMore: 已请求页码 {JSON.stringify(loadedPages)} (reset() 每次从第 0 页起)</p>
		<Button mode="text" text="调用 reset()" onclick={() => loadHandle?.reset()} />
		<LoadMore bind:this={loadHandle} api={loadPage} />
		<Button
			mode="text"
			text="触发 TryCatch 示例"
			onclick={() => void probe.tryCatch(() => { throw new Error('演示错误'); }, 'demo')()}
		/>
		<TryCatch handle={probe} />
	</section>

	<section>
		<h2>Route</h2>
		<RouteDemo />
	</section>
</main>

<style>
	:global(body) {
		margin: 0;
		background: var(--base-bg);
		color: var(--base-fg);
		font-family: system-ui, sans-serif;
	}

	main {
		display: grid;
		gap: 24px;
		padding: 16px;
	}

	.toolbar {
		display: flex;
		gap: 12px;
		align-items: center;
	}

	h2 {
		margin: 0 0 12px;
		font-size: 16px;
		color: var(--accent-color);
	}

	section {
		display: grid;
		gap: 12px;
	}

	/* CenterBox 的 w/h 是父容器百分比, 给它一个定尺宿主 */
	.center-host {
		width: 100%;
		height: 90px;
	}

	.nav-host {
		height: 400px;
		overflow: hidden;
	}

	/* NavTab 内部高度是 100vh, 演示容器按 400px 宿主改写 */
	.nav-host :global(.nav-tab),
	.nav-host :global(.nav-tab > .tab-nav),
	.nav-host :global(.nav-tab > .panel) {
		height: 100%;
	}

	/* ListBox 继承父高度做虚拟滚动, SortListBox 需要可见高度 */
	.list-host {
		height: 260px;
		overflow: hidden;
	}
</style>
