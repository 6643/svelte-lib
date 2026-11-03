# 逐组件 Svelte 母语化重构 (第三轮)

**状态:** 方案已定, 待批准后进入 plan

**前置:** 第一轮翻译 (`2026-10-21-svelte-component-library-design.md`)、第二轮范式重写
(`2026-10-22-svelte-idiom-refactor-design.md`)、第三轮动画迁移
(`2026-10-23-css-animation-to-svelte-motion-design.md`) 均已落地.

## 想要什么

把 `src/` 里剩下的"翻译味"清掉: 逐个组件、逐个 hook、逐个 util 按 Svelte 5 的母语重写一遍,
让每个文件的形态都像这个生态里长出来的代码, 而不是 solid 版的行对行移植. 允许破坏性变更.

判据只有一条: **这个写法在 Svelte 5 里有更直接的原语, 而现在的写法是在手工模拟它.**

## 现状盘点 (证据)

手工模拟的地方分五类, 每类都有明确替代.

### 1. 手写 DOM 观察者, 而 `svelte/reactivity` + 附件已够

| 位置                                        | 现状                                                                                       | 问题                                                                                                                          |
| ------------------------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| `src/hooks/useVis.ts`                       | 自建模块级 `IntersectionObserver` + `Map<Element, cb>`                                     | 重新实现了 `svelte/reactivity` 已提供的"外部源 -> 响应式"桥; 单例 observer 的清理逻辑要自己写                                 |
| `src/hooks/useResize.ts`                    | 同上, `ResizeObserver`                                                                     | 同上; 且没有 `contentRect` 的"上一次值"语义, 调用方拿不到变化前后                                                             |
| `src/hooks/useMutation.ts`                  | 自建按 `JSON.stringify(options)` 分组的 observer 池, 每次解绑把全体目标重新 `observe` 一遍 | 池化收益远小于复杂度; `selectRelevantMutations` 的手工过滤在 `{ subtree: true }` 下会重复通知                                 |
| `src/hooks/createDebouncedSignal.svelte.ts` | `$effect` + `setTimeout` 手写 debounce                                                     | `svelte/reactivity` 没有现成的, 但 `createDebounce` 已存在, 这里在重复实现; 且 `$effect` 在 `source` 只变一次时也会重排定时器 |

### 2. `$effect` 里做本来该由模板表达式做的事

| 位置                        | 现状                                                                      | 换成                                                                                                                                                                                               |
| --------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/FlexBox.svelte:51-64`  | `$effect` 遍历 `container.children` 逐个写 `style.alignSelf/flexGrow/...` | 子元素是调用方的, 无法在模板里 `style:`; 但可以让盒子把自己的布局意图写成 CSS 变量 `--flex-child-n`, 子元素用 `:global(> :nth-child(n))` 消费 —— 需先确认"逐子元素数组"这个契约值得保留 (见决策 1) |
| `src/GridBox.svelte:37-42`  | `$effect` 给每个子元素写 `style.gridArea = '_n'`                          | 同上; 而且 `toArgs` / `toIndex` 两个纯函数藏在组件里, 应当进 `utils/` 并有测试                                                                                                                     |
| `src/StackBox.svelte:16-32` | `$effect` 每次清四个属性再按 `pos` 重写                                   | 可以直接 `style:--left={...}` 之外用 `--pos` 索引方案; 至少要把"清旧值"改成一次性派生, 不依赖 DOM 读回                                                                                             |
| `src/Field.svelte:24-49`    | `$effect` 里跑校验, 用 `seq` 手写竞态守卫                                 | `$derived` 只能给同步值; 异步校验应当用 `$effect` + `AbortController`, 或者干脆收进 `createValidation` 工厂 (有测试) 让 Field 只剩渲染                                                             |

### 3. 手写的定时器状态机, 而 Svelte 有 `tick` / `createTween` / `$effect.pending`

| 位置                               | 现状                                                                  | 换成                                                                                                                   |
| ---------------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `src/Tab.svelte:159-172`           | `setTimeout` 延后一拍量指示条 (等字体/布局)                           | `await tick()` + `$effect` 里读稳定值; 或用 `useResize` 的 ResizeObserver 版本 (元素尺寸变化才重量)                    |
| `src/Tab.svelte:245-256` + `:203`  | `clickIndex` + 500ms 定时器压制滚动计算                               | 用 `svelte/motion` 之外的显式"滚动锁定"状态 + `scrollend` 事件; 至少把魔法 500 与 smooth 时长解耦                      |
| `src/CountDown.svelte:36-60`       | `setInterval(1000)` + `finished` 布尔 + `queueMicrotask` 双重触发保护 | 计时器该留在 `hooks/createCountdown.svelte.ts`, 组件只渲染; 双重保护可去掉 (interval 里 `remaining <= 0` 分支已经清表) |
| `src/hooks/useKeepScroll.ts:32-37` | 恢复滚动用 `setTimeout(0)`                                            | `await tick()` 后赋值; 语义更准 ("DOM 更新完" 而不是 "下一轮宏任务")                                                   |
| `src/hooks/useRefresh.ts`          | 类名切换 + `--pull-height` + `DONE_ANIMATION_DURATION_MS` 定时器      | 保留 pointer 高频路径的 CSS, 但把状态机抽成 `createPullRefresh` 工厂 (可单测, 不碰 DOM)                                |

### 4. 重复的"同一件事写两遍"

| 位置                                                                   | 现状                                                                           | 换成                                                                                                              |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `src/CountDown.svelte` + `src/Counter.svelte`                          | 都各自 `DIGITS = [0..9]` + `{#each ... (index)}` + `<DigitWheel>`              | 抽出 `<DigitRow values={digits} direction>` 内部组件; `DIGITS` 进 `utils/digits.ts`                               |
| `src/Tab.svelte`                                                       | 8 条 `createTween` + `css()` 收尾 + 5 个形态各自的 `{#snippet}`; 单文件 769 行 | 拆 `tab/Indicator.svelte` (按 mode 给变量) 与 `tab/Nav.svelte`; `css()` 进 `utils/round.ts`                       |
| `src/Input.svelte`                                                     | 10 个 mode 挤在 449 行, 8 个 `$derived` 收窄 + 5 个分支模板                    | 按 mode 拆 3 个内部组件 (text-like / check-like / captcha) 或保留一处但把共用外壳 (`Field` + 右槽按钮) 抽 snippet |
| `src/themeMode.ts` + `src/themeAccent.ts` + `src/themeStore.svelte.ts` | 两份 storage 读写 + 两份模块级可变状态, 再在 store 里镜像一遍                  | 合成单个 `theme.svelte.ts`: 一份 `$state` 是唯一真源, storage 只在初始化读一次、写入时落盘                        |
| `src/AccentSelector.svelte`                                            | `open` 布尔 + `display:none` 切换, 点击外部不收起                              | 用 `{#if}` + `useClickOutside`; 关闭状态由 Svelte 的挂载语义表达                                                  |

### 5. 契约层面的手工产物

| 位置                             | 现状                                                         | 换成                                                                                      |
| -------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `src/SortListBox.svelte:164`     | `{#each items as item, index (index)}` 以索引为键            | 按 item 键 (要求 item 可比较) 或新增 `key` prop; 这是 `animate:flip` / 重排动画的前置条件 |
| `src/SortListBox.svelte:112-118` | 拖拽结束后 `Promise.resolve().then()` 清内联样式             | `await tick()` 后清, 语义是"DOM 已按新顺序更新完"                                         |
| `src/ImagePlayer.svelte`         | `{#each imgs as src, i (i)}` 以索引为键, 两份 DOM            | 索引键在这里是对的 (同一张图重复), 保留; 但要加注释说明为什么不用 item 键                 |
| `src/Modal.svelte`               | `$effect(() => { if (mounted && !el.open) el.showModal() })` | 可保留, 但缺 `dialog` 未挂载时的 `close()` 与"父级直接卸载"路径的兜底                     |

## 三条路线

### 路线 A: 只清"手写原语" (小而稳)

只做上面第 1、3 类的替换: observer 类 hook 改 `svelte/reactivity` 风格, 定时器改 `tick`/工厂,
不动组件结构、不拆文件、不改公开契约.

- 收益: 每次改动都能用现有测试守住.
- 代价: `Tab` 769 行、`Input` 449 行、8 条重复 tween 这类"读起来就不是 Svelte 代码"的问题全部留下.
- 结论: 达不到"逐个组件重构优化"的目标.

### 路线 B: 按组件重切 (结构优先)

除了第 1、3 类, 还做第 2、4 类: 把 `Tab` 拆成 `tab/` 子目录、`Input` 按 mode 拆分、
`CountDown`/`Counter` 共用 `DigitRow`、`theme` 三文件合一. 公开契约尽量保持.

- 收益: 每个文件的职责单一, 单测可按子单元写.
- 代价: 内部拆分不影响对外 API, 但"逐子元素数组"这类 props 仍要靠 `$effect` 写 DOM (第 2 类没解决);
  文件名/目录变化会让 `dist/` 多出一批新模块, 需要补 `public-api.test.ts` 之外的"文件清单"守护.
- 结论: 是"重构优化"的主体, 但不彻底.

### 路线 C: 契约也重写 (彻底母语化)

B 之上再做第 5 类: `FlexBox`/`GridBox`/`StackBox` 的逐子元素数组改成 CSS 变量契约,
`SortListBox` 加 `key`, `useVis`/`useResize`/`useMutation` 改返回响应式值而不是回调.

- 收益: 全库不再有"用 `$effect` 手动写子元素 style"的代码, 也没有靠索引当键的列表.
- 代价: **破坏性变更面最大**; 逐子元素数组改成 CSS 变量后, 运行时给第 3 个子元素设 `flex-grow: 2`
  这种用法会变成写 `--fg-3: 2` 或干脆不支持; `useVis` 从回调改取值会让现有 demo/测试全部改写.
  用户已授权破坏性变更, 但要付出一次迁移成本.
- 结论: 推荐作为**第三轮的目标形态**, 但分阶段落地, 让每一步都能独立验证.

## 采用: C (全部, 分阶段)

**采用路线 C: 内部结构 (B) + 公开契约 (C) 一起重写, 按"证据强度"排序执行, 每个阶段一次全绿校验.**
路线 A 的改动是 C 的子集, 因此下面三个阶段即 C 的全部范围:

1. **阶段一 (纯内部, 零契约变更)**: `theme` 三文件合一、`CountDown`/`Counter` 共用 `DigitRow`、
   `DIGITS`/`toArgs`/`toIndex`/`css` 进 `utils/`、`useKeepScroll` 改 `tick`;
   `Tab` 拆 `tab/` 子组件、`Input` 拆 `input/` 子组件.
2. **阶段二 (hook 契约变更)**: `useVis`/`useResize`/`useMutation` 拆成"`createXxx()` 返回值 +
   `useXxx(cb)` 附件"两层 (共享一份订阅); `useRefresh` 拆出 `createPullRefresh` 状态机;
   `createDebouncedSignal` 复用 `createDebounce`.
3. **阶段三 (组件契约变更)**: `SortListBox` 键契约 + `await tick()` 清理;
   `FlexBox`/`GridBox`/`StackBox` 的逐子元素数组改 CSS 变量 (见决策 1);
   `AccentSelector` 改 `{#if}` + `useClickOutside`.

### 决策 1: 逐子元素数组改 CSS 变量 (已定: 改)

三个盒子组件现在都靠 `$effect` 读 `container.children` 手动写内联样式. 这确实不母语,
但**Svelte 没有"从父组件给 snippet 子节点加 style"的原语**: 子节点由调用方渲染, 父组件拿不到
模板句柄. 所以可选只有三条:

- (a) 保留 `$effect` + 内联写样式 (现状), 只把"清旧值"逻辑改成派生.
- (b) 改成 CSS 变量契约 (`--fg-3` 之类), 调用方自己写 `style:`. 破坏性, 但零 JS 逐子元素循环.
- (c) 改成"传 slot 包装组件" (`<FlexItem grow={2}>`), 最母语, 但组件数翻倍.

**采用 (b):** 数组 props 保留为"输入", 组件把每一维转成 CSS 变量写在自己的根元素上
(`--child-1-grow: 2` 这类), 子元素用 `:global(> :nth-child(n))` 消费, 不再逐个子元素写内联 style,
也不再需要 `container` 引用与 `$effect`. 转换逻辑是纯函数, 放 `utils/childLayout.ts` 并有单测.
理由 (路线 C 的前提): 逐子元素 `$effect` 是本库最后一处"父组件伸手改子节点"的代码;
换成变量后布局意图是数据, 归 CSS 消费, 符合"显式数据流".

代价: `flex-grow` 等从内联 style 变成 `calc(var(--fg-n, 1))`, 外部用 `!important` 覆盖内联样式
的老技巧失效; `GridBox` 的 `grid-area` 仍需要逐子元素名字, 用 `--grid-areas` 一次给全表代替.

### 决策 2: hook 返回"响应式值"还是"回调" (已定: 值)

`useVis` 现在收回调. 改成返回响应式值 (`const visible = useVis(() => el)`) 会与"attachment
返回 cleanup"的既有约定冲突 (attachment 的返回值只能是 cleanup). 所以只剩:

- (a) 保留 attachment + 回调, 删掉模块级池化, 每个元素一个 observer.
- (b) 新增 `createVisibility()` 工厂返回 `{ current }`, 元素用 `bind:this` 传入.

**采用"值"形态, 两条都给:** 观测类 hook 改成 `createXxx()` 工厂, 返回 `{ current }` 响应式值
(内部用 `svelte/reactivity` 的 `SvelteSet`/`Unstate` 不需要, 直接用 `$state`),
元素通过 `bind:this` 或 `{@attach}` 注册; 同时保留 `useXxx(cb)` 附件形态, 内部复用同一个工厂.
理由: 只返回值时调用方没法用 `{@attach}` 的自动重挂; 只保留回调又拿不到"值"组合能力.
两者共用一份订阅实现, 复杂度只写一次.

### 由我决定的部分

- 拆分粒度: `Tab` 拆到 `src/tab/` 目录 (`Indicator.svelte` / `Nav.svelte` / `panels.svelte`),
  `Input` 拆到 `src/input/` 目录; 两者都在 `index.ts` 保持原有顶层导出.
- 新工具函数放 `src/utils/`, 都配 `.test.ts`.
- 所有"魔法数字"提为文件内 `const` 并加注释说明来源 (源码 CSS 时长 / 阈值).
- 不做: 引入 `svelte/store`、引入第三方动画库、把 CSS 变量名改掉.

### 实施记录 (与本文最初的差异)

落地时按证据做了几处调整, 记录在此以便回溯:

- **盒子组件加了 `data-child-*` 守卫**: 静态 `:nth-child` 规则的选择器优先级高于子组件
  自己的单类规则, 若无条件写 `flex-grow: var(--child-N-grow, 0)`, 未传 `fg` 时会把子元素
  自己的 `flex-grow` 覆盖成 0. 因此每条规则都挂在 `.flex-box[data-child-grow]` 之类的守卫下,
  未传数组时整条规则不生效. 上限常量为 `CHILD_LIMIT = 12`, 写进 README 的已知限制.
- **`GridBox` 的子元素不需要变量**: 子元素默认 `grid-area: _N` 是纯序号, 直接写成静态
  `:nth-child(n) { grid-area: _n }`, 连变量都不必生成.
- **观测类 hook 的公共骨架提取到 `hooks/observer.ts`**: `createSize` / `createVisibility` /
  `useResize` / `useVis` / `useMutation` 共用 `observe(Ctor, notify)` 的挂载与清理,
  每个元素一个 observer.
- **`createPullRefresh` 用 `onChange` 回调驱动重绘**: 状态机内部有定时器路径 (`Done -> Nil`),
  只靠 `$state` 读属性无法在附件里可靠触发重绘, 因此状态落定统一走 `commit()` 并回调.
- **`Field` 的异步校验竞态改用 effect 清理函数**: 删掉 `seq` 计数器, 值再变即作废上一次
  结果, 与 Svelte 的清理语义一致.
- **`Modal` 的 `close()` 改成幂等**: 同一个 Escape 在真实浏览器里先触发 keydown 再派发
  `cancel`, 两条路都走 `close()`, 用 `open` 本身去重, `onClose` 只触发一次.
- **`route` 的注册表换成 `SvelteMap`**: 删掉手写的 `registryVersion` 计数.
- **额外修掉的三处泄漏**: `createCopy` 的 2s 复位定时器 (`dispose()`), `createThrottle`
  补 `cancel()`, `pickFile` 的两条结算路径互相摘监听 (原来 `change` 先到时 focus 仍会覆盖成 null).
- **`Box` 在无标题且无操作区时不渲染 `.header`**: 原来永远渲染一条 48px 高的空条.
- **`Tab` / `Input` 的拆分粒度收窄**: `Tab` 只抽出 `tab/Panel.svelte` 与 `tab/navMetrics.ts`,
  没有拆 `Indicator.svelte` / `Nav.svelte` —— 指示条是纯 CSS 伪元素 (变量驱动), 五种导航形态
  各自绑定不同变量, 拆出去只会把 `bind:this` 与附件从状态持有者手里拿走. `Input` 拆出 5 个子
  组件 + `input/captcha.ts`, 因为那里确实有独立的输入决策逻辑.

## 非目标

- 不改视觉 (颜色/尺寸/间距/曲线). 只改"谁驱动"和"代码放哪".
- 不改 `route` 子路径的状态机语义.
- 不为兼容旧 API 留 shim; 破坏性变更直接删旧参数.
- 不追求"每个组件一个目录"; 只有确实超过 400 行且职责明显可切的才拆.

## 验收

- `npx vp test --run`: 全绿, 且**测试数只增不减** (拆分出的新单元各自有测试).
- `npx svelte-check --tsconfig ./tsconfig.json`: 0 error 0 warning.
- `npx vp check`: 两行 pass.
- `npx vp build` + `pnpm run prepack`: 成功, publint `All good`.
- README 与 `docs/superpowers/specs/*.md` 同步契约变化.
