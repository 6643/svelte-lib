# 去 Solid 化重构 (设计)

日期: 2026-10-22
目标目录: `/home/_/._/lib/svelte`

## 背景

第一轮移植是"逐行翻译": 保留 solid 的 API 形状 (accessor 参数、getter 返回值、
`changed` 回调、`toStyleString`、`getEl` 取值函数). 这些在 Svelte 里都是外来范式,
导致组件内部大量 `untrack` 镜像、调用方写样板 `<Input changed={(v) => (x = v)} />`.

## 目标

把每个组件 / hook / util 的**对外契约**换成 Svelte 5 母语, 内部实现随之简化:

| 旧 (solid 迁移)                   | 新 (Svelte 惯用)                             | 理由                                              |
| --------------------------------- | -------------------------------------------- | ------------------------------------------------- |
| `value` + `changed(value)` 回调   | `value = $bindable()` + `bind:value`         | 双向绑定是一等公民, 调用方不再写中间函数          |
| `checked` + `changed(checked)`    | `checked = $bindable()` + `bind:checked`     | 同上                                              |
| 单选 `checked` + `changed(value)` | `group = $bindable()` + `bind:group={sel}`   | Svelte 原生单选组语义                             |
| `index` + `changed(i)`            | `index = $bindable()` + `bind:index`         | 同上                                              |
| `readonly={!changed}` 兜底        | 删除                                         | 绑定即受控; 不再需要"没回调就只读"的补丁          |
| `getEl: () => El` 形参            | `{@attach useXxx(...)}`                      | 元素由 attachment 天然提供, 且自动随依赖重跑/清理 |
| `useClass(el, name)` action       | attachment                                   | action 需要 `bind:this`, attachment 不需要        |
| 返回 `() => T` 的工厂             | 返回带 `$state` 字段的对象/类                | 读属性即订阅, 也能直接 `bind:`                    |
| `toStyleString({'--x': v})`       | `style:--x={v}`                              | 原生指令, 不用拼字符串; 仅保留给 `style` 透传     |
| `tap` 回调 prop                   | `onclick`                                    | 组件事件直接用 DOM 名                             |
| `useLoad.read()` 调试壳           | 直接暴露 `page` / `hasMore` / `loading` 字段 | 去掉无意义包装                                    |

## 非目标

- 不改视觉与 CSS 变量名.
- 不改 `route` 子路径的状态机语义 (`parseParam` 仍返回 accessor, 因为它是"订阅当前路由"的读函数,
  不是可变状态).

## 兼容性

这是**破坏性**重构: 旧参数 (`changed` / `getEl` / `tap`) 直接删除, 不做兼容层.
README 的差异表与"已知限制"同步更新, 并写明新写法.

## 验收

- `vp check` 0 lint/type; `svelte-check` 0/0; `vp test` 全绿; `vp build` + `prepack` publint 通过.
- 每个模式在浏览器里实测: 双向绑定回写、单选组互斥、滚动钩子随元素挂载/卸载.

## 落地结果 (执行后增补)

执行中发现的偏差与补充决定:

| 项                              | 决定                                                              | 依据                                                                                                                       |
| ------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `useLoadMore` 是否自动补首页    | **不补**                                                          | 附件挂在 `$effect` 里, 读 `page/hasMore/loading` 会形成 `effect_update_depth_exceeded`; 与源实现一致改为由外部调 `reset()` |
| `useMediaQuery`                 | 改名 `createMediaQuery`, 返回 `svelte/reactivity` 的 `MediaQuery` | 框架已提供同类实现, 自己重写等于重造订阅逻辑                                                                               |
| `useTheme` / `useAccent`        | 改为模块级单例 `theme` / `accent`                                 | 状态本来就是模块单例, 每次调用工厂只是多余的句柄包装                                                                       |
| `useWakeLock`                   | 改名 `createWakeLock`                                             | 它是工厂 (返回 `{supported, active, setActive}`), 与 `create*` 约定一致                                                    |
| `useFilePicker` / `useImgScale` | 改名 `pickFile` / `scaleImage`                                    | 一次性动作返回 `Promise`, 没有挂载/释放语义                                                                                |
| `Tab` 的 `onIndexChange`        | 改名 `onchange`                                                   | 与 `onclick` / `onDone` 等事件命名统一                                                                                     |
| `LoadMore` 的 `reset`           | 保留组件导出方法 + `bind:this`                                    | Svelte 5 支持 `bind:this` 读组件实例导出, 比 `onReady` 回调更直接                                                          |
| `Input mode="range"`            | 也改成 `bind:value`                                               | 原来 `value` + `oninput` 手写, 统一后三个数值模式同一条路径                                                                |
| `readonly` 缺省                 | **可编辑**                                                        | 用户明确要求; `$bindable` 无法探测父级是否绑定, 只能显式声明                                                               |

仍然保留 solid 形状的部分 (有意为之):

- `parseParam` / `parseParams` 继续返回 `() => T`: 它们是"订阅当前路由"的读函数,
  不是可变状态, 没有可写目标.
- `route` 子路径的注册表/历史/滚动恢复逻辑保持原语义, 只改键名与命名空间前缀.

## 追加决定 (prop 命名避让 Svelte 语义)

Svelte 有一批名字自带语义, 用作 prop 会误导调用方或直接冲突. 本轮统一改名:

| 组件                     | 旧 prop                             | 新 prop                    | 依据                                                      |
| ------------------------ | ----------------------------------- | -------------------------- | --------------------------------------------------------- |
| `Card` / `Carousel` 等 5 | `class`                             | `className`                | `class` 是 JS 保留字, 只能 `class: className` 重命名      |
| `ImagePlayer`            | `children: string[]`                | `imgs`                     | 子节点会被当作 `children` snippet 传入, 与数组同type 冲突 |
| `TimeLine`               | `children: Event[]`                 | `events`                   | 同上; 同时本地 `type Event` 改名 `TimelineEntry` 避让 DOM |
| `Tab`                    | `key`                               | `storageKey`               | `key` 在 Svelte 里是 `{#key}` 块身份                      |
| `SortListBox`            | `renderItem` / `actions`            | `children` / `itemActions` | 与 `ListBox` 统一, 用原生插槽名                           |
| `TryCatch`               | `store`                             | `handle`                   | `store` 在 Svelte 生态专指 `svelte/store`                 |
| `<Route>`                | `when?: boolean \| (() => boolean)` | 删除                       | 条件渲染用 `{#if}` 即可, 卸载即注销; thunk 是 solid 惯性  |

`Route` 删 `when` 后, `RegisteredRoute` 也不再带 `isEnabled`: 注册表只记录"当前挂载了谁",
条件判断收敛到调用方的模板里, 数据流变成 挂载 -> 注册 / 卸载 -> 注销 两条单向路径.
