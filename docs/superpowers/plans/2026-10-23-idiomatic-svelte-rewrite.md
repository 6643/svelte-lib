# 逐组件 Svelte 母语化重构 实施计划

> **For agentic workers:** 按任务顺序执行, 每个任务以自己的测试收尾; 阶段末跑一次全绿 + 真实浏览器验证.

**Goal:** 把 `src/` 里"手工模拟 Svelte 原语"的代码逐个换掉, 允许破坏性契约变更.

**Architecture:** 纯转换逻辑进 `utils/` (有单测); 状态机进 `hooks/` 的 `createXxx` 工厂;
组件只做渲染. 超过 400 行且职责可切的组件拆到同名子目录.

**Spec:** `docs/superpowers/specs/2026-10-23-idiomatic-svelte-rewrite-design.md`

## Global Constraints

- 禁止删/跳过/放宽测试; 断言跟随新契约改写, 测试数只增不减.
- 视觉不变: CSS 变量名、颜色、尺寸、间距、曲线保持原值.
- 中文注释, ASCII 标点; 契约变化同步 README 与 spec.
- 每个任务收尾跑 `npx vp test --run`; 阶段末跑 `npx svelte-check` + `npx vp check` + 真实浏览器验证.

---

## 阶段一: 内部结构 (零契约变更)

### Task 1: 纯转换函数进 `utils/`

**Files:** Create `src/utils/digits.ts`、`src/utils/gridAreas.ts`、`src/utils/round.ts` 及各自 `.test.ts`;
Modify `src/Counter.svelte`、`src/CountDown.svelte`、`src/GridBox.svelte`、`src/Tab.svelte`.

- [x] Step 1: 写失败测试: `DIGITS` 是 0..9; `toGridAreas('a,b;c,d') === '"_a _b" "_c _d"'`;
      空段丢弃; `toGridAreaName(1) === '_1'`, 非数字原样返回; `roundCss(1/3) === 0.333`.
- [x] Step 2: 实现三个纯函数文件.
- [x] Step 3: 组件改为引用.

### Task 2: `theme` 三文件合一

**Files:** Create `src/theme.svelte.ts`; Delete `src/themeMode.ts`、`src/themeAccent.ts`、`src/themeStore.svelte.ts`;
Modify `src/index.ts`、`src/ThemeSwitch.svelte`、`src/AccentSelector.svelte`、`src/theme.test.ts`.

- [x] Step 1: 现有 `theme.test.ts` 改 import 到新模块 (断言不变, 先红).
- [x] Step 2: 实现单文件: 唯一真源是模块级 `$state`; storage 只在 init 读一次, set 时落盘;
      system 模式订阅 `matchMedia` change.
- [x] Step 3: 保持 `index.ts` 的导出名单不变 (公开符号表守护 `public-api.test.ts` 不动).

### Task 3: `DigitRow` 复用 `Counter` / `CountDown`

**Files:** Create `src/DigitRow.svelte`; Modify `src/Counter.svelte`、`src/CountDown.svelte`.

- [x] Step 1: 测试: `Counter`/`CountDown` 现有显示断言不变 (作为回归).
- [x] Step 2: 抽 `<DigitRow values={DIGITS} digits={[1,2]} {direction}>`, 逐位渲染 `DigitWheel`.
- [x] Step 3: `CountDown` 保留冒号插槽 (用 snippet 或 `gap` 参数).

### Task 4: `useKeepScroll` 用 `tick()`

**Files:** Modify `src/hooks/useKeepScroll.ts`, `src/hooks/scroll-hooks.test.ts`.

- [x] Step 1: 测试: 恢复滚动在 DOM 更新后发生 (现有断言不变).
- [x] Step 2: `setTimeout(0)` -> `void tick().then(...)`, 卸载时用标志位丢弃.

### Task 5: `Tab` 拆 `src/tab/`

**Files:** Create `src/tab/Panel.svelte`、`src/tab/navMetrics.ts` (+ `.test.ts`);
Modify `src/Tab.svelte`.

- [x] Step 1: 先跑 `tabs.test.ts` 记录基线 DOM 断言 (类名/变量/结构).
- [x] Step 2: 面板渲染抽到 `Panel.svelte` (`kind="single" | "list"`), `{#key}` 重播入场、
      `--progress` 与 `data-direction` 都留在 `Tab`, 由 props 传入.
- [x] Step 3: nav 的几何计算抽成纯函数 `measurePanels` / `computeNavMetrics` (10 条单测),
      `Tab` 只做 DOM 量测与状态写入.
- [x] Step 4: `setTimeout` 量指示条改 `await tick()` + `useResize` 重量; `clickIndex` 的 500ms
      改 `scrollend` + 兜底常量 `CLICK_SCROLL_SETTLE_MS`.
- 备注: 没有拆出 `Indicator.svelte` / `Nav.svelte`. 指示条完全是 CSS 伪元素 (变量驱动),
  拆组件只会多一层 props 透传; 导航条五种形态各绑定不同的 `--index/--top/--height/--len`,
  而且 `nav-list` 的 `bind:this` 与附件必须留在持有状态的组件里. 拆分收益不足以抵消耦合.

### Task 6: `Input` 拆 `src/input/`

**Files:** Create `src/input/TextField.svelte`、`CheckField.svelte`、`CaptchaField.svelte`、
`NumberField.svelte`、`RangeField.svelte`、`captcha.ts` (+ `.test.ts`); Modify `src/Input.svelte`.

- [x] Step 1: `form.test.ts` 作为回归基线 (DOM 结构/类名不变).
- [x] Step 2: captcha 的输入决策进 `src/input/captcha.ts` (`applyCaptchaInput` / `filterCaptchaText`,
      11 条单测): 只认退格/插入/粘贴三种输入, 其余一律丢弃并恢复原值.
- [x] Step 3: 按 mode 拆出 5 个子组件, `Input.svelte` 只剩联合类型收窄与分发.
- 备注: 子组件用 `bind:value` 的函数式绑定接收父级值, `bind:group` 走原样绑定
  (`bind:group` 不支持函数式绑定).

---

## 阶段二: hook 契约

### Task 7: 观测类 hook 拆两层

**Files:** Create `src/hooks/createVisibility.svelte.ts`、`src/hooks/createSize.svelte.ts`;
Modify `src/hooks/useVis.ts`、`src/hooks/useResize.ts`.

- [x] Step 1: 测试: `createSize()` / `createVisibility()` 的取值、批次取值、卸载 disconnect、
      不支持观察者时不抛错 (8 条, 用假观察者驱动, 不依赖真实布局).
- [x] Step 2: 实现 `hooks/observer.ts` 公共骨架 + 两个工厂; `useResize` / `useVis` 改走同一骨架,
      删掉模块级 observer 池.
- 备注: 附件形态没有复用工厂的 `$state` (附件里新建工厂等于给每个元素一份死状态),
  共用的是 `observe(Ctor, notify)` 这一段挂载/清理逻辑.

### Task 8: `useMutation` 去池化

- [x] Step 1: 现有 `dom-hooks.test.ts` 覆盖"子节点变化时回调"; `selectRelevantMutations` 保留并继续导出.
- [x] Step 2: 每个元素一个 observer, 解绑直接 `disconnect` (不再重挂剩余目标).

### Task 9: `useRefresh` 拆状态机

**Files:** Create `src/hooks/createPullRefresh.svelte.ts`; Modify `src/hooks/useRefresh.ts`.

- [x] Step 1: 状态机单测 11 条 (初始态, 未到阈值回弹, 过阈值, 夹紧, 上滑, Loading 期忽略,
      Done 定时回落, dispose 取消), 不碰 DOM.
- [x] Step 2: 附件只负责 pointer 事件与类名/变量写入; 状态落定统一走 `commit()` + `onChange`
      回调, 否则 `Done -> Nil` 这条定时器路径无法触发重绘.

### Task 10: `createDebouncedSignal` 复用 `createDebounce`

- [x] Step 1: 测试不变 (合并窗口语义不变).
- [x] Step 2: 实现改为 `createDebounce` + `$effect` 清理 (`return commit.cancel`).

### Task 11: `CountDown` 计时器进 hook

**Files:** Create `src/hooks/createCountdown.svelte.ts`; Modify `src/CountDown.svelte`.

- [x] Step 1: 状态机 5 条单测 (起始值, 到 0 恰好一次, 停表, 起始 0, 自定义间隔);
      `display.test.ts` 的两条断言 (恰好一次 / 卸载后不触发) 仍通过.
- [x] Step 2: 实现 `createCountdown` (单条不变量: 减到 0 的那拍结算并停表), 删掉 `finished`
      标志与 `queueMicrotask`.

---

## 阶段三: 组件契约

### Task 12: `SortListBox` 键契约 + `await tick()`

**Files:** Modify `src/SortListBox.svelte`、`src/list.test.ts`、`README.md`.

- [x] Step 1: 新增 `key?: (item: T, index: number) => unknown` prop, 缺省回退到索引;
      拖拽结束清理改 `await tick()` (`Promise.resolve().then` 等价但意图更明确).
- [x] Step 2: 测试 2 条 (`SortHost` fixture): 传 `key` 时重排复用 item 的 DOM 节点;
      不传时按下标复用 (缺省行为不变). 真实浏览器里验证了拖拽的位移、换序与内联样式清理.

### Task 13: 盒子组件的子元素布局改 CSS 变量

**Files:** Modify `src/FlexBox.svelte`、`src/GridBox.svelte`、`src/StackBox.svelte`;
Create `src/utils/childLayout.ts` + 测试; Modify `src/layout.test.ts`.

- [x] Step 1: 测试: 根元素出现 `--child-N-grow` / `--child-N-left` 等变量, 子元素不再有内联样式;
      超上限的项被忽略; 未传数组时不产生变量与守卫属性.
- [x] Step 2: 实现纯函数 `toChildVars` / `toChildPosVars` / `toVarsStyle` (13 条单测).
- [x] Step 3: `src/childLayout.css` 用静态 `:nth-child(n)` 规则消费变量, 删掉 `container` 引用与 `$effect`.
- 备注: 每条规则都挂在 `.flex-box[data-child-grow]` 之类守卫下 —— 静态规则优先级高于子组件
  自己的单类规则, 无守卫会把未设置的子元素 `flex-grow` 覆盖成 0. 上限 `CHILD_LIMIT = 12`.

### Task 14: `AccentSelector` 用 `{#if}` + `useClickOutside`

- [x] Step 1: 测试 6 条: 默认收起 (面板不在 DOM), 展开/收起 + `aria-expanded`, 选中色板后
      应用并收起, selected 标记, 点外部收起 (点面板内部不收起), 色板都有可访问名称.
- [x] Step 2: 实现 `{#if}` + `useClickOutside`; 删除 `display:none` 切换; `Button` 新增
      `ariaExpanded` / `ariaControls` prop.

---

## 阶段末验证

- [x] `npx vp test --run` 全绿, 用例数 >= 238.
- [x] `npx svelte-check --tsconfig ./tsconfig.json` 0 error 0 warning.
- [x] `npx vp check` 两行 pass.
- [x] `npx vp build` + `pnpm run prepack` publint `All good`.
- [x] Chrome + playwright-cli: `vp dev` 起服务, 逐组件目测与逐帧采样 (Tab 五形态指示条、Modal 四向、
      Carousel、DigitWheel、SortListBox 拖拽、盒子组件布局、theme 切换、下拉刷新).
