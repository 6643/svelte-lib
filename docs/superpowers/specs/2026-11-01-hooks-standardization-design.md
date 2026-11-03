# hooks 标准化 (第四轮)

**状态:** 待批准

**前置:** 第三轮 Svelte 母语化重构
(`2026-10-23-idiomatic-svelte-rewrite-design.md`) 已落地, 其"决策 2"把观测类 hook 定成
"工厂 + 附件两条都给". 本轮不推翻该决策, 只把它执行到位, 并修掉执行过程留下的不一致.

## 想要什么

`src/hooks/` 现在"读起来乱", 根源不是命名前缀, 而是**同一件"组件销毁时谁清理"的事有四种写法**.
调用方无法凭签名判断要不要接管生命周期. 目标是收敛成一条可预测的规则, 并让每个文件都符合它.

允许破坏性变更.

## 现状审查 (证据)

### A. 生命周期归属四分

| 归属 | 文件 | 证据 |
| --- | --- | --- |
| 工厂内部 `$effect` 自管 | `createFullscreen` / `createWakeLock` / `createTween` / `createDebouncedSignal` | `createFullscreen.svelte.ts:8`, `createWakeLock.svelte.ts:43`, `createTween.svelte.ts:41`, `createDebouncedSignal.svelte.ts:14` |
| **调用方**手动接管 | `createCopy` (`dispose`) / `createCountdown` (`start`) | `createCopy.svelte.ts:57-58`, `createCountdown.svelte.ts:40-44` |
| 附件 `(el) => cleanup` | 全部 `useXxx` | 略 |
| 返回 `void` 但内部开 `$effect` | `useKeyPress` | `useKeyPress.svelte.ts:14` |

### B. 由此产生的真实缺陷

1. **`createCopy` 的定时器泄漏.** 注释要求调用方写 `$effect(() => clip.dispose)`
   (`createCopy.svelte.ts:10`), 但全仓调用点无一处照做: 只有 `state-hooks.test.ts:157` 调了 `dispose`;
   `test/fixtures/SignalProbe.svelte:16` 与 `demo/App.svelte` 都没调. 卸载后 2 秒定时器仍在写已销毁组件的 `$state`.
2. **`createCountdown` 同理.** 唯一的调用点 `src/CountDown.svelte:45` 必须手写 `$effect(() => countdown.start())`,
   而其它工厂都不需要这行. 同一目录里两种心智负担.
3. **`createStorage.update` 依赖 `this`.** `createStorage.svelte.ts:38` 的 `this.value = ...` 在解构调用
   (`const { update } = createStorage(...)`) 时 `this` 为 `undefined`. 同文件其余 API 都是闭包, 只有这一处破了约定.

### C. 重复与绕行

4. **`useResize` 与 `useVis` 逐字相同.** `diff` 去掉名字后只剩第一行注释有差异. `observer.ts:18` 的骨架被
   5 个文件引用, 其中 `useMutation.ts:19-26` 又绕开它自己写了一遍 observer 挂载/断开.
5. **`useLoadMore` 住在 `createLoad.svelte.ts:79`.** 一个文件两种语义 (工厂 + 附件), 违反 README
   `README.md:130` 的"文件名 == 主导出名".
6. **`useRefresh.ts:3-11` re-export 了 `createPullRefresh.svelte.ts` 的 6 个常量.** 导出关系绕了一圈.

### D. 类型与契约

7. **自定义附件类型别名.** `ScrollEndAttachment` (`useScrollEnd.ts:3`) 等价于官方
   `svelte/attachments` 的 `Attachment` (`node_modules/svelte/types/index.d.ts:725`), 且该别名全仓无引用.
8. **`selectRelevantMutations` 公开导出但全仓无外部引用** (`index.ts:99`), 仅 `useMutation` 内部使用.
9. **`peerDependencies` 写的是 `svelte: ^5.0.0`** (`package.json:57`), 但代码已经依赖:
   attachment 语法 (5.29+, `types/index.d.ts:748`), `prefersReducedMotion` (5.7+), `MediaQuery` (5.7+).
   安装到 5.0–5.28 的项目会编译失败.

### E. 测试失真

10. **`dom-hooks.test.ts:118-131` 是空测试.** 名字叫 "useResize / useVis 能挂上观察者", 内容是自己
    `new ResizeObserver(...)` / `new IntersectionObserver(...)`, 再断言这两个全局是函数.
    hook 的回调 `onResize` / `onVis` 从未被断言.
    **实测**: happy-dom 对这两个 observer 从不派发回调 (回调次数 0), 所以即便断言也是红的.
    真正的验证在 `createObservers.test.ts` 里用假构造器完成.

## 设计主张

### 规则一: 生命周期只归工厂内部, 调用方不写清理代码

`createXxx()` 必须自己收拾干净. 这条取代 "调用方接管" 的两种写法.

由此产生一个技术约束, 已实测:

- 内部开 `$effect` 的工厂**只能在组件初始化期调用** — 组件外调用抛
  `effect_orphan` (`effects.js:54-61`).
- 需要"组件外也能创建"的, 用 `svelte/reactivity` 的 `createSubscriber`
  (`create-subscriber.js:54`, 5.7+), 它惰性订阅, 读属性时才开始, 无读者时自动停.
  实测在组件内外均不抛, 且能驱动模板更新.

**取值规则**: 纯"外部事件 → 响应式值"的用 `createSubscriber`; 必须在挂载/卸载时做命令式副作用的
(申请 WakeLock, 中止 RAF 补间) 用 `$effect`. 两者都满足规则一.

### 规则二: `useXxx` 的语义是"需在组件初始化期注册的绑定", 不限于附件

README `README.md:135` 现在把 `useXxx` 窄定义为 "返回 `(el) => cleanup`". 这排除了 `useKeyPress`
这类绑全局对象的绑定. 放宽为:

> `useXxx` = 依赖组件上下文的绑定. 元素绑定返回附件 `(el) => cleanup`; 全局绑定 (window/document)
> 内部开 `$effect`, 返回 `void`.

这样 `useKeyPress` 归位, 不需要改名也不需要造假元素.

### 规则三: 附件类型一律用官方 `Attachment`

`import type { Attachment } from "svelte/attachments"`, 不再自定义别名.

### 规则四: 事件监听统一走 `svelte/events` 的 `on()`, 指针类例外

`on(el, type, fn)` 返回 off 函数, 且保证与模板声明式处理器 (`onclick={...}`) 的顺序一致
(`node_modules/svelte/src/internal/client/dom/elements/events.js:94-111`).

**例外一 (时序)**: 源码 `events.js:82-89` 显示 `pointer*` / `touch*` / `wheel` 三类事件被
`queue_micro_task` 延后一个微任务才真正 `addEventListener` (规避 Chrome 的 cloneNode bug).
`useGestures` / `useRefresh` 依赖同步挂载, 改用 `on()` 会改变时序并让现有测试失败.
这两处保留 `addEventListener`, 并在注释里写明原因与来源.

**例外二 (非事件)**: `useMutation` 用的是 `MutationObserver`, 不是事件监听器, 无法走 `on()`,
保留现有 `observer` 形态.

实测确认 `on()` 在本项目需要的四类目标上都可用: 组件外的 `window`、`document.body`、
元素上的 `passive` 监听、以及普通元素.

## 改动清单

按"证据强度"排序, 每阶段一次全绿校验.

### 阶段一: 生命周期归位 (破坏性)

| 文件 | 改动 |
| --- | --- |
| `createCopy.svelte.ts` | 内部加 `$effect` 收尾定时器; 删除 `dispose` 及其文档示例 |
| `createCountdown.svelte.ts` | 内部加 `$effect` 起表/停表; 删除 `start()`; 保留 `tick()` 供单测驱动 |
| `src/CountDown.svelte:45` | 删除 `$effect(() => countdown.start())` |
| `createStorage.svelte.ts:36-39` | `update` 去掉 `this`, 改为闭包写 `value` + 落盘 |
| `state-hooks.test.ts` | `createCopy` 的两个用例改为经组件 (fixture) 驱动 |
| `createCountdown.test.ts` | 全部用例改为经组件驱动; `tick()` 的纯数据用例保留 |
| `test/fixtures/` | 新增 `CountdownProbe.svelte`; `SignalProbe` 暴露 `copy.copy()` 触发入口 |

**语义变更 (实测确认)**: `$effect` 在组件挂载后才执行, 所以工厂自持定时器意味着
"**创建后不立即走, 挂载完成后才开始**". 实测时序:

```
mount=3|false|0    ← effect 未运行
tick=3|false|0
1s=2|false|1       ← effect 跑到, interval 起来
3s=0|false|1
```

这对 `CountDown` 是更好的语义 (它本来就在 `:45` 无条件 `start()`), 但
`createCountdown.test.ts:12-31` 现在的写法是"调 `start()` 后立即 advance 1000ms 就减到 0",
必须重写成"挂载后 advance". 这不是删一行 API 就完事的机械改动.

`createCopy` 与 `createCountdown` 变成组件内专用后, 组件外调用会抛 `effect_orphan`.
这是规则一的直接后果, 且与 README `README.md:127` 已有的"必须在组件初始化期间调用"一致.
受影响的具体调用点已全量核对: `createCopy` 3 处 (`SignalProbe.svelte:16` 组件内, 测试 2 处组件外),
`createCountdown` 1 处 (`CountDown.svelte:32` 组件内).

### 阶段二: 去重与拆文件

| 文件 | 改动 |
| --- | --- |
| `observer.ts` | 新增 `observeAttachment(Ctor, name, notify)` 作为唯一挂载骨架 |
| `useResize.ts` / `useVis.ts` | 各自缩成一次 `observeAttachment` 调用 |
| `useMutation.ts` | 改走 `observeAttachment` (需支持 `MutationObserverInit` 透传); **不走 `on()`** |
| `useLoadMore.ts` | 从 `createLoad.svelte.ts` 拆出独立文件 |
| `useRefresh.ts` | 删除 re-export; 常量的导出改由 `index.ts` 直接指到 `createPullRefresh.svelte.ts` |

### 阶段三: 类型与事件

| 文件 | 改动 |
| --- | --- |
| 全部附件 hook | 返回类型标注为 `Attachment<HTMLElement>`; 删除 `ScrollEndAttachment` |
| `useClickOutside` / `useScrollEnd` / `useKeyPress` / `createFullscreen` | 改用 `on()` 并删掉成对的 remove |
| `useGestures` / `useRefresh` | 保留 `addEventListener`, 加注释说明微任务延后 |
| `useMutation` | 保留 `observer`, 它不是事件监听器 |

### 阶段四: 文档与护栏

| 文件 | 改动 |
| --- | --- |
| `README.md:130-139` | 按规则一/二重写命名约定; 更新 hooks 表格 |
| `index.ts` | 停止导出 `selectRelevantMutations`; 跟随文件拆分调整路径 |
| `package.json:57` | `peerDependencies.svelte` 改为 `^5.29.0` |
| `dom-hooks.test.ts:118-131` | 删除空测试, 由 `createObservers.test.ts` 的假构造器覆盖 |
| `public-api.test.ts` | 无需改: `selectRelevantMutations` 本就不在该清单内 (已核实) |

## 非目标

- 不改 `createSize` / `createVisibility` 的 `{ current, attach }` 混合形态. 第三轮"决策 2"已明确
  "两条都给", 本轮只把它的实现接上统一骨架.
- 不改 `createTween` 的补间收尾逻辑 (上一轮刚修过, 有测试守着).
- 不改 `createMediaQuery`. 它是一行包装, 但提供了稳定的公开名并隔离了 `svelte/reactivity` 的直接依赖.
- 不引入新依赖, 不引入 `svelte/store`.
- 不改 `getPos` / `setPos` / `delPos` 的模块级 Map. 它是页面级可重置的显式外部状态, 不是 hook 生命周期问题.

## 由我决定的部分

- `useKeyPress` 保留 `$effect` 形态与现名, 不改成 `<svelte:window {@attach ...}>`. 后者会把
  "script 里一行" 变成 "模板里一个标签", 对调用方是净损失. 已在上一轮与你确认.
- `createCountdown` 的 `tick()` 保留为公开方法. 它是纯数据推进, 无副作用, 让单测不必依赖时钟.
- `observeAttachment` 的 `name` 参数只用于 `getCtor`, 保持调用点可读.
- 阶段之间可以单独合入; 阶段一之后 `public-api.test.ts` 会红一次 (删了两个公开成员), 同步改即可.

## 残余风险

- `createCopy` / `createCountdown` 的破坏性变更会让现有组件外用例直接抛错. 全仓已知调用点只有
  `CountDown.svelte` 与测试 fixture, 已列入阶段一.
- `peerDependencies` 收紧到 `^5.29.0` 会让 5.0–5.28 的安装报 peer 冲突. 这是把既有的隐含要求
  显式化, 不是新增限制.
- 阶段三把 `useClickOutside` 等改用 `on()` 后, 与模板声明式处理器的相对顺序会变化. 这些 hook
  的目标元素通常不与声明式处理器竞争同一事件, 但若出现顺序相关的回归, 回退到 `addEventListener` 即可.
