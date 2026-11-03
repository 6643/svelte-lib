# svelte-components

Svelte 5 UI 组件库 (纯组件库, 非 SvelteKit 项目).
由 SolidJS 版 `solid-lib` 逐文件翻译而来, 组件与 hook 名称保持 1:1;
对外契约已经按 Svelte 5 母语重写 (双向绑定 / attachment / `style:` 指令),
见 [与 Solid 版的差异](#与-solid-版的差异).

## 技术栈

- 构建与工具链: [Vite+](https://viteplus.dev) (vite / rolldown / vitest / oxlint / oxfmt / task)
- 框架: Svelte 5 (runes 模式)
- 库打包: `@sveltejs/package` (`svelte-package`) + `publint`
- 类型检查: `svelte-check` + `tsc`
- 测试: `vite-plus/test` (vitest) + `@testing-library/svelte` + `happy-dom`

## 目录结构

```
src/            组件库源码, 整个目录会被 svelte-package 打包进 dist/
                (单元测试与源码同目录, 发布时由 package.json 的 files 排除)
  index.ts      库入口 (按 Buttons / Input / Layout / ... 分组导出)
  _.css         全局设计令牌 (CSS 变量)
  svgicons.ts   Material Symbols 图标常量 (每个图标一个具名导出)
  hooks/        依赖 Svelte 运行时的逻辑复用 (runes / attachment / effect 挂载)
  utils/        与框架无关的纯函数 (无 runes, 可在任意 JS 环境跑)
demo/           本地演示/自测页面, 不参与发布; 也是 dev server 与 build 的根 (vite root)
  index.html    演示站入口
test/fixtures/  测试用宿主组件 (需要真实子节点/受控宿主时使用)
docs/           设计文档与翻译计划 (superpowers)
dist/           库产物 (svelte-package 生成, 已 gitignore)
build/          演示站产物 (vp build 生成, 已 gitignore)
```

## 常用命令

```sh
vp install        # 安装依赖
vp dev            # 启动 demo 开发服务器
vp build          # 构建 demo 到 build/
vp preview        # 预览 demo 产物

vp check          # oxfmt 格式检查 + oxlint 类型感知检查
vp check --fix    # 自动修复
vp test           # 跑单元测试
vp lint           # 只跑 lint
vp fmt            # 只跑格式化

npx svelte-check --tsconfig ./tsconfig.json   # .svelte 类型检查
pnpm run prepack                              # svelte-package -i src + publint
```

## 配置说明

所有工具配置集中在 `vite.config.ts`:

- `plugins`: `@sveltejs/vite-plugin-svelte`
- `build.outDir`: `build/`, 与库产物 `dist/` 分离
- `resolve.conditions`: `['browser']`, 否则 Svelte 会解析到 server 版, `mount` 直接抛错
- `test`: `happy-dom` 环境, 扫 `src/**/*.test.ts` 与 `demo/**/*.test.ts`
- `lint` / `fmt`: 忽略 `dist/**` 与 `build/**`; `typeAware` + `typeCheck` 开启 tsgolint 类型检查

`pnpm-workspace.yaml` 里的 `catalog` + `overrides` 把 `vite` 指到
`@voidzero-dev/vite-plus-core`, 保证插件和工具链共用同一份 Vite;
`peerDependencyRules` 是为这条 alias 关掉 vite 版本号不匹配的告警 (core 的版本号是 1.3.0, 不落在插件的 `^8` 区间内).

## 组件清单

| 分组        | 组件                                                                                                                                              |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Buttons     | `Button` (外观由 `mode` 决定: `filled` / `outlined` / `text` / `icon`)                                                                            |
| Input       | `Input` (形态由 `mode` 决定: `text` / `textarea` / `password` / `email` / `tel` / `number` / `range` / `checkbox` / `radio` / `captcha`), `Field` |
| Layout      | `Block` `Card` `CenterBox` `FlexBox` `GridBox` `StackBox`                                                                                         |
| Interaction | `Modal` (方向由 `mode` 决定) `Expand` `Carousel` `Tab` (布局由 `mode` 决定: `bottom` / `top` / `left` / `menu` / `nav`)                           |
| Display     | `AvatarImage` `CountDown` `Counter` `DigitWheel` `TimeLine` `ImagePlayer` `ListBox` `SortListBox` `SvgIcon`                                       |
| Functional  | `CityPicker` `LoadMore` `ThemeSwitch` (=`ThemeToggle`) `AccentSelector` (=`AccentPicker`)                                                         |

## 主题

`_.css` 提供设计令牌, 主题模式与强调色是模块级单例:

```ts
import { initTheme, initAccent } from "svelte-components";

initTheme(); // 读 localStorage(svelte-lib:theme-mode), 写 <html data-theme-mode>
initAccent(); // 读 localStorage(svelte-lib:accent), 写 --accent-color
```

两处初始化都要在应用启动时调用一次, 否则刷新后 `localStorage` 里的主题不会生效
(演示站见 `demo/main.ts`). 之后 `theme` / `accent` 两个单例对象与 `<ThemeSwitch>` /
`<AccentSelector>` 都是读写这同一份状态:

```svelte
<script>
	import { theme, accent } from "svelte-components";
</script>

<span>{theme.mode} → {theme.resolved}</span>
<button type="button" onclick={() => theme.toggle()}>切换</button>
<button type="button" onclick={() => accent.set("#2196f3")}>强调色</button>
```

## 路由 (子路径 `svelte-components/route`)

与 solid `solid-lib/route` 一一对应, 是本库唯一的非 UI 子模块:

| 名称                                                                                   | 说明                                                             |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `<Route path component>`                                                               | 静态路径精确匹配; `/*` 兜底; 条件渲染直接用 `{#if}` (卸载即注销) |
| `normalizePathname` / `matchesExactRoute` / `isFallbackRoutePath`                      | 路径归一化与匹配                                                 |
| `registerRoute` / `unregisterRoute` / `hasActiveExactRoute` / `hasActiveFallbackRoute` | 注册表                                                           |
| `parseParam` / `parseParams`                                                           | query 参数 accessor                                              |
| `pushRoute` / `replaceRoute` / `getRouteBackPath`                                      | 导航 (depth + backPath 写入 `history.state`)                     |
| `recordScroll` / `markTraversal` / `pruneScroll` / `restoreScroll` / `readScrollDepth` | 滚动恢复                                                         |
| `ensureRouteState` / `readLocation` / `resetRouteForTests`                             | 端口绑定与状态读取                                               |

路由块在挂载时自动 `ensureRouteState()` (幂等, 无浏览器时 no-op), 因此只要页面上有
`<Route>` 就会接管文档级链接拦截与滚动恢复.

与 solid 版的差异: `ensureRouteState()` 无参调用在已绑定端口时直接返回既有句柄, 不会用
`globalThis.window` 顶掉注入的端口 (测试友好).

## Hooks & Utils

分层原则 (判据是"要不要 Svelte 运行时"):

- `src/hooks/` — 依赖 Svelte 运行时: 用 runes (`$state` / `$effect`) 或 attachment 形态,
  必须在组件初始化期间调用 (rune / 附件只在组件上下文里生效).
  生命周期一律由 hook 自己收尾, 调用方不写清理代码.
- `src/utils/` — 与框架无关的纯函数: 没有 runes, 在普通 `.ts` 里也能 import 和调用.

命名约定 (文件名 == 主导出名, 唯一例外是同类多导出的聚合文件):

- `createXxx` — **工厂**: 调用后产出一个带状态/方法的对象, 状态字段是 `$state`,
  读属性即订阅, 可直接 `bind:` (如 `bind:value={store.value}`). 工厂内部用 `$effect`
  或 `createSubscriber` 自己管生命周期, 调用方不需要 `dispose` 或 `start`.
  例如 `createTry` / `createCopy` / `createStorage` / `createCountdown`.
- `useXxx` — **组件上下文绑定**: 元素绑定返回附件 `(el) => cleanup`, 用法
  `{@attach useXxx(...)}`, 元素由 Svelte 注入, 挂载/卸载自动管理, 调用点读到的状态
  变化时会先清理再重挂; 全局绑定 (window / document) 内部开 `$effect`, 返回 `void`.
  例如 `useClickOutside` / `useScrollEnd` / `useKeyPress`.
- 无前缀动词 — 一次性动作或纯转换, 无状态. 例如 `pickFile` / `scaleImage`.
- `*.svelte.ts` 后缀 — 只有含 runes 的文件才需要, 以便 Svelte 编译器处理; 纯 `.ts` 不带.

| Hooks / Attachments (`src/hooks/`)                                                           | 说明                                                  |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `createMediaQuery(query)`                                                                    | 媒体查询 (`svelte/reactivity` 的实例)                 |
| `createDebouncedSignal(source, ms)`                                                          | 延迟跟随的派生值 (`{ current }`)                      |
| `createCopy()`                                                                               | 剪贴板写入 + `copied` 标记 (无需 dispose)             |
| `createFullscreen()`                                                                         | 全屏开关与状态 (`{ isFullscreen, toggle }`)           |
| `createStorage(key, fallback)`                                                               | 与 localStorage 同步的值 (`{ value, update }`)        |
| `createTry()` + `<TryCatch>`                                                                 | 捕获调用失败并展示                                    |
| `useClickOutside` / `useMutation` / `useResize` / `useVis`                                   | DOM 监听 (附件形态, 给回调)                           |
| `useKeyPress`                                                                                | 全局按键监听 (`$effect` 形态, 返回 void)              |
| `createSize()` / `createVisibility()`                                                        | 元素尺寸 `{ width, height }` / 是否可见 `{ visible }` |
| `useTap` / `useLongPress`                                                                    | 指针手势                                              |
| `createLoad` + `useLoadMore` (`getPos`/`setPos`/`delPos`) / `useKeepScroll` / `useScrollEnd` | 分页与滚动记忆                                        |
| `useRefresh` + `createPullRefresh`                                                           | 下拉刷新 (状态机可单测, 含 `refresh.css`)             |
| `createCountdown(initial, onDone)`                                                           | 倒数计时, 挂载即走, 卸载即停, 到 0 恰好回调一次       |
| `createWakeLock`                                                                             | 屏幕常亮 (`{ supported, active, setActive }`)         |

附件用法:

```svelte
<!-- 元素自带 scroll 监听, 卸载时自动清理 -->
<main {@attach useScrollEnd((top) => record(top))}>
	…
</main>

<!-- 下拉刷新 -->
<div class="page" {@attach useRefresh(() => api.reload())}>…</div>
```

| Utils (`src/utils/`)                               | 说明                                |
| -------------------------------------------------- | ----------------------------------- |
| `createDebounce` / `createThrottle` / `createOnce` | 防抖 / 节流 / 只执行一次 (无 runes) |
| `toChildVars` / `toChildPosVars`                   | 逐子元素布局数组转 CSS 变量表       |
| `pickFile`                                         | 弹文件选择框, 返回 `Promise`        |
| `scaleImage`                                       | 图片等比压缩, 返回 `Promise`        |
| `createHttp` / `http`                              | fetch 封装                          |
| `getChinaTimestamp()`                              | `YY-MM-DD HH:mm:ss` (Asia/Shanghai) |

> `pickFile` / `scaleImage` 第二轮重构从 `useFilePicker` / `useImgScale` 改名而来:
> 它们是一次性动作, 返回 `Promise`, 没有挂载/释放语义, 所以不叫 `useXxx`.
> `createTry` 虽然产出的是 state, 但需要调用方持有返回对象并读取 `errors`,
> 属于"工厂"语义, 因此留在 `hooks/` (它需要 runes 才能工作).

## 动画

动效由三类载体分工, 判据是"有没有状态 / 会不会结束":

| 载体                                                 | 适用                                         | 本库中的例子                                                                                                               |
| ---------------------------------------------------- | -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `svelte/transition`                                  | 有状态, 有限时长, 进出场对称                 | `Expand` 内容 `in:fly` / `out:fly`                                                                                         |
| `svelte/motion` (`Spring` / `Tween` / `createTween`) | 有状态, 有限时长, 元素常驻或卸载要显式控制   | `DigitWheel` 数字轮 (`Spring`), `Carousel` 位移, `Modal` 进出场, `Tab` 面板与指示条 (`Tween`)                              |
| CSS `@keyframes` / `transition`                      | 无状态无限循环、伪元素反馈、pointer 高频路径 | `Button` 呼吸灯与水波, `ImagePlayer` 跑马灯, `refresh.css` 的 loading 条, `Field`/`Input` 的描边色, `SortListBox` 拖拽让位 |

要点:

- 时长/曲线是 JS 里的字面量 (`Modal` 256ms, `Tab` 512ms, `Carousel` 240ms), 不再有
  "JS 定时器对齐 CSS 时长" 的隐性耦合.
- 需要"补间完成后做下一步"时, `Tween#set()` 返回的 Promise 就是唯一时序源
  (`Modal` 的卸载、`Expand` 的退场).
- 用户开启"减少动效"时: `createTween` 与 `DigitWheel` 直接跳到目标值,
  `svelte/transition` 用 `prefersReducedMotion.current` 把时长压到 0.
- `DigitWheel` 早期自己写 `setTimeout` 步进 (`position += delta * 0.18`), 现已换成
  `Spring({ stiffness: 0.18, damping: 1 })`: 同样的收敛速率, 但由 Svelte 统一调度,
  卸载时不会留下定时器.
- 保留 CSS 的两类理由写在各组件注释里; `SortListBox` 的让位是 TODO —
  还债条件: 当拖拽需要跨行动画或支持触控惯性时, 再换成 `Spring` 并用
  `preserveMomentum`.

## 已知限制 (继承自源实现)

以下行为与 solid 版逐行一致, 不是移植引入的问题, 使用前需要知道:

| 位置                           | 现象                                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------- |
| `useScrollEnd` / `useLoadMore` | scroll 监听挂在目标元素**自身**, 页面滚动不会触发; 只有该元素自己可滚动时"触底"才成立 |
| `LoadMore.reset()`             | 页码复位到 0, 重复调会重复请求第 0 页; 组件不会自动补首页, 需要外部调一次             |
| 字符串类字段                   | 默认可编辑; 需要只读时显式传 `readonly`                                               |
| `CenterBox`                    | `w`/`h` 是父容器的**百分比**, 父容器没有高度时算不出尺寸                              |
| `ListBox` / `SortListBox`      | 尺寸继承父容器 (`width/height: inherit`), 父容器必须给高度, 否则虚拟滚动不成立        |
| `Tab mode="nav"`               | 高度写死 `100vh`; 要嵌在定尺容器里需在该上下文中覆盖高度                              |
| `StackBox`                     | 子元素的位移完全来自 `pos`, 不传 `pos` 时全部叠在同一点                               |
| `FlexBox` / `StackBox`         | 逐子元素数组最多生效 12 项 (`childLayout.css` 的静态 `:nth-child` 规则上限)           |
| `$bindable`                    | 子组件无法判断父级是否 `bind:`; 不绑定时组件内部自持值 (输入不丢字, 但外层读不到)     |

## 与 Solid 版的差异

文本严格 1:1 翻译, 但以下位置因框架语义不同做了显式调整:

| 位置            | Solid                                                                                                                                                  | Svelte                             | 原因                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------- | --------------------------------------------------------------------- |
| 按钮四件套      | `IconButton` / `TextButton` / `FilledButton` / `OutlinedButton`                                                                                        | 单个 `<Button mode={...}>`         | 四个组件只是同一个 base 的不同 class, 合成后一处契约                  |
| 弹层四件套      | `BottomModal` / `TopModal` / `LeftModal` / `RightModal`                                                                                                | 单个 `<Modal mode={...}>`          | 同上                                                                  |
| 输入十件套      | `RangeInput` / `TextInput` / `TextArea` / `PasswordInput` / `NumberInput` / `EmailInput` / `TelInput` / `CheckButton` / `RadioButton` / `CaptchaInput` | 单个 `<Input mode={...}>`          | 十个组件共用同一个内部 `Input` 外壳与 `useField` 校验, 合成后一处契约 |
| `createTry`     | 返回对象含 `TryCatch` 渲染函数                                                                                                                         | `createTry()` + `<TryCatch>` 组件  | Svelte 里渲染函数必须是 snippet/组件, 无法挂在返回值上                |
| 元素类 hook     | `useX(el, …)` 显式传元素                                                                                                                               | `{@attach useX(…)}` (attachment)   | 元素由 Svelte 注入, 卸载自动清理, 依赖变化自动重挂                    |
| 状态类 hook     | `createEffect` + 信号                                                                                                                                  | `*.svelte.ts` + `$state`/`$effect` | rune 必须在 `.svelte.ts` 内声明                                       |
| 全屏/弹层       | `<Portal>`                                                                                                                                             | 原生 `<dialog>` + `showModal()`    | 无 Kit/Portal 依赖, 保留顶层渲染与焦点管理                            |
| `LoadMore`      | `bind:this` 调 `reset` + 组件不自动起步                                                                                                                | 同源: `bind:this` 调 `reset`       | 组件级导出方法; 自动补首页会造成 update_depth 死循环                  |
| Tab 五件套      | `BottomTab` / `TopTab` / `LeftTab` / `MenuTab` / `NavTab`                                                                                              | 单个 `<Tab mode={...}>`            | 五个组件共用同一套索引记忆与滚动钩子, 合成后一处契约                  |
| CSS Modules     | `*.module.css`                                                                                                                                         | 组件 `<style>` (作用域)            | Svelte 原生作用域; 运行时切换的类名用 `:global()` 或独立全局 CSS      |
| 自定义 CSS 变量 | `style={{ '--x': v }}`                                                                                                                                 | `style:--x={v}`                    | 原生指令; 对象 `style` 会丢弃 `--x`, 也不必再拼字符串                 |
| `Route` 组件    | 返回 accessor 的普通函数                                                                                                                               | `<Route>` 组件 + `$derived`        | Svelte 组件即渲染单元, 无法返回节点 accessor                          |
| `route` 子路径  | `solid-lib/route`                                                                                                                                      | `svelte-components/route`          | 同名子路径, 一并从 `index.ts` 再导出                                  |

### 对外契约 (破坏性变更)

第二轮重构把 solid 范式全部换掉, 旧参数**直接删除**, 不保留兼容层:

| 位置                                         | 旧写法                                        | 新写法                                                               |
| -------------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------- |
| `Input` / `Counter` / `Carousel` / `ListBox` | `value={x} changed={(v) => (x = v)}`          | `bind:value={x}` / `bind:checked` / `bind:group` / `bind:index`      |
| `SortListBox`                                | `items={x} hookChange={(next) => (x = next)}` | `bind:items={x}` (旁路通知用 `onreorder`)                            |
| `CityPicker`                                 | `open` + `onOpenChange` / `change`            | `bind:open` / `bind:cityCode` + `onselect`                           |
| `Modal`                                      | `open` + 只能回调关                           | `open = $bindable()`; 内部关闭会写回 `open=false`                    |
| `CountDown`                                  | `done`                                        | `onDone`                                                             |
| `Button`                                     | `tap`                                         | `onclick`                                                            |
| `Input` 只读                                 | 不传 `changed` 即只读                         | 显式 `readonly` (缺省可编辑)                                         |
| 状态类 hook                                  | `const [get, set] = createStorage(…)`         | `const store = createStorage(…)`; 读 `store.value`                   |
| `useWakeLock`                                | `useWakeLock()` + `isSupportedWakeLock()`     | `createWakeLock()` + `supported` / `setActive()`                     |
| `useMediaQuery`                              | `useMediaQuery(q)` 返回 accessor              | `createMediaQuery(q)` 返回 `MediaQuery` 实例                         |
| `useTheme` / `useAccent`                     | `const t = useTheme()` 每次取句柄             | `import { theme, accent }` 模块级单例                                |
| `useFilePicker` / `useImgScale`              | `useFilePicker()` / `useImgScale(file)`       | `pickFile()` / `scaleImage(file)` (一次性动作, 无挂载语义)           |
| `useLoad`                                    | `useLoad(el, api, args)` 返回 `{load, reset}` | `createLoad(api, getArgs)` + `{@attach useLoadMore(handle)}`         |
| `FlexBox` / `GridBox` 的 `style`             | `Record<string, string>`                      | 字符串透传 (自定义变量用 `style:--x`)                                |
| `ImagePlayer` / `TimeLine` 的数据            | `children: string[]` / `children: Event[]`    | `imgs` / `events` (`children` 是 snippet, 数组会与插槽冲突)          |
| `Tab` 的存储键                               | `key`                                         | `storageKey` (`key` 在 Svelte 里是 `{#key}` 块身份)                  |
| `SortListBox` 的插槽                         | `renderItem` / `actions`                      | `children` / `itemActions` (与 `ListBox` 统一)                       |
| `TryCatch` 的实例                            | `store`                                       | `handle` (`store` 专指 `svelte/store`)                               |
| `<Route>` 的 `when`                          | `boolean \| (() => boolean)`                  | 已删除, 用 `{#if}` 控制挂载 (没挂载就不注册, 兜底接手)               |
| `history.state` 键 / 滚动缓存键              | `__solid_route__` / `solid-route:scroll`      | `__svelte_route__` / `svelte-route:scroll`                           |
| 盒子组件的逐子元素微调                       | 子元素上的内联 `flex-grow` / `grid-area`      | 根元素上的 `--child-N-*` CSS 变量 + `data-child-*` 守卫              |
| `SortListBox` 的行身份                       | 只能按下标 (重排会复用错节点)                 | 新增 `key?: (item, index) => unknown`, 缺省仍按下标                  |
| 观测类 hook                                  | 只有 `useVis(cb)` / `useResize(cb)` 回调形态  | 另加 `createSize()` / `createVisibility()` 返回值形态                |
| `AccentSelector`                             | 面板常驻 DOM, 用 `display` 开关               | 关闭时不在 DOM; 点外部与选中色板都会收起, 触发按钮带 `aria-expanded` |

## 添加组件

1. 在 `src/` 下新建 `<Name>.svelte`
2. 在 `src/index.ts` 对应分组导出
3. 在 `src/<domain>.test.ts` 补测试 (RED 先行)
4. 在 `demo/App.svelte` 里挂上做本地验证

约定:

- 带 rune 的 `.ts` 模块必须命名 `*.svelte.ts`, 引用时写全后缀
- props 初值快照用 `untrack(() => prop)`, 避免 `state_referenced_locally` 告警
- `bind:this` 的目标必须声明为 `$state`
- 类名用 `class="base {className}"` + `class:flag={cond}`, 不要写 `class={[...]}` / `class={{ ... }}`
- 外部类名 prop 统一叫 `className` (不用 `class`): `class` 是保留字, 只能 `class: className` 重命名,
  多一层心智负担; `className` 前后端同名, 直接插值即可
- 可选 snippet 直接用 `{@render children?.()}`, 不要套 `{#if children}{@render …}{/if}`
- 同一段结构重复出现 (或单块嵌套超过 3 层) 时抽成本组件的局部 `{#snippet}`, 名字用名词
  (`singlePanel` / `iconTab` / `scrollNav`); 只放结构, 状态仍留在 `<script>`
- 模板顺序: 先写对外可见的 `{@render children}` / 顶层条件块, 再写 `{#snippet}` 定义,
  让读代码的人第一屏就看到渲染结果 (snippet 前向引用合法)
- 自定义 CSS 变量用 `style:--x={v}`, 不要拼 `style` 字符串
- `children` 只留作 snippet; 数组型数据用语义名 (`imgs` / `events` / `items`)
- 避让 Svelte 语义名: `children` / `key` / `class` / `style` / `store` 各有既定含义,
  同名 prop 会误导调用方. 按语义换名 (`imgs` / `events` / `storageKey` / `className` / `handle`)
- 仅图标按钮要给 `ariaLabel`, 文案用英文 (组件内不写中文)
- 需要真实子节点的测试用 `test/fixtures/*.svelte` 宿主, 不要用 `createRawSnippet`

## 发布前检查

```sh
npx vp check
npx svelte-check --tsconfig ./tsconfig.json
npx vp test
npx vp build
pnpm run prepack
```

预期: check 两条 pass; svelte-check 0 error 0 warning; test 全绿; build 产出
`build/index.html`; prepack 输出 publint `All good!`, `dist/` 含 `index.js`、`index.d.ts`
与每个组件的 `.svelte` + `.svelte.d.ts`.
