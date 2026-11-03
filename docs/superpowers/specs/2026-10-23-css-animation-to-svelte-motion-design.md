    方案定了之后再看落地细节.

## 方案 (先选路线, 再动手)

有三条可行路线. 共同点是"CSS 只留视觉, 时序归 JS", 差别在于**谁拥有动画的生命周期**.

### 方案 A: 全部换成 `svelte/transition` (`fly` / `slide`)

`{#if}` / `{#key}` 上的元素挂 `in:` / `out:`, 卸载时机交给 Svelte.

- 优点: 代码最短, 与 Svelte 生态一致; 进出场对称, `Expand` / `Modal` 里"JS 定时器等 CSS 时长"的
  隐性耦合直接消失.
- 缺点: **卸载时机变成不可测**. 实测 happy-dom 里 `element.animate()` 不触发 `finish`,
  `playState` 永远停在 `running`: 带 `out:` 的元素在单测里永远不会移除. `Tab` 的
  `{#key activeIndex}` 一旦带 `out:`, `querySelector('main')` 会拿到旧面板, 十来个断言全线失效;
  `Modal` 的 `dialog` 会一直处于 `open`, 让后续用例的页面保持 inert.
- 结论: 只用在 `Expand` 展开收起 (`in:fly` / `out:fly`, 本来就要求"旧内容退场后再卸载").
  `Tab` 面板不用 `transition:`: 它的卸载是 `{#key}` 触发的立即替换, 再叠退场动画会改变语义;
  且 `cancel()` 在 happy-dom 下抛未处理的 `AbortError`, 见下面「落地决定」.

### 方案 B: 用 `svelte/motion` 的 `Spring` / `Tween` 驱动 CSS 变量

动画值仍是 CSS 变量, 但每帧的值由 JS 算, CSS 里不再写 `transition` / `@keyframes`.

- 优点: 时长/曲线/进度是 JS 字面量, 全库只有一处定义; 卸载仍是显式状态机, 单测可测
  (`Spring`/`Tween` 走 `requestAnimationFrame`, happy-dom 下 fake timers 能推进 — 已实测);
  指示条这类"目标值本来就是数字"的位置可以直接补间, 不必绕 CSS 过渡.
- 缺点: 每帧触发一次 style 写入 (只改一两个自定义属性, 成本可忽略); 需要自己保证
  "动画中途再次改目标"的行为 (Tween 会中止上一段, 从当前值重新起补).
- 结论: 作为主力路线, 覆盖 `DigitWheel` / `Tab` 指示条 / `Modal` / `Carousel`.

### 方案 C: 保留 CSS, 只把魔法数字抽成共享常量

改动最小, 但动画仍然留在 `<style>` 里, "to svelte" 这个目标没有达成.

- 结论: 只作为**保留项**的兜底理由 (无限循环 / 伪元素 / pointer 高频路径).

### 采用

**A + B + C 按动效性质分工**:

1. 有状态、有限时长、进出场对称 (内容进出, 旧节点退场后才卸) → `svelte/transition` (方案 A).
2. 有状态、有限时长、元素常驻或卸载时机要自己控制 → `svelte/motion` (方案 B).
3. 无状态无限循环 (`Button` 呼吸灯 / `ImagePlayer` 跑马灯 / `refresh` 的 loading 条) 与
   伪元素 pointer 反馈 (`Button` 水波 / `Input` 点选扩散) → 保留 CSS (方案 C), 因为 JS
   版本只会把主线程锁进无收尾的每帧循环.
4. `SortListBox` 拖拽让位保留 CSS `transition`: 那是 pointer 高频路径, 位移已经由
   `pointermove` 逐事件写入, 再叠一层 RAF 补间只会增加抖动. 标注 TODO 与还债条件.

对应表:

| 位置                       | 现在                                 | 改后                                                        |
| -------------------------- | ------------------------------------ | ----------------------------------------------------------- |
| `DigitWheel`               | 手写 `setTimeout` 弹簧               | `Spring` (已完成, 60 行调度代码删除)                        |
| `Expand` 内容              | `@keyframes open/close` + 400ms 守卫 | `in:fly` / `out:fly` (512ms)                                |
| `Tab` 面板切换             | 4 个 keyframes + `data-direction`    | `Tween` 进度写 `--progress`, 位移仍由 `data-direction` 派生 |
| `Tab` 指示条 (5 种形态)    | CSS `transition` on left/top/...     | `Tween` 驱动同一个 CSS 变量                                 |
| `Modal` 位移 + 遮罩透明度  | CSS `transition` + 256ms 定时器      | `Tween` 进度变量 + 补间完成即卸挂                           |
| `Carousel` 位移            | CSS `transition: transform`          | `Tween` 驱动 `--index` 百分比                               |
| `Button` 呼吸灯 / 水波     | keyframes / 伪元素                   | 保留                                                        |
| `ImagePlayer` 跑马灯       | 无限 `@keyframes`                    | 保留                                                        |
| `refresh.css` loading/done | 无限 keyframes                       | 保留                                                        |
| `SortListBox` 让位         | `transition 0.15s`                   | 保留 (TODO, 见上)                                           |
| `Field` / `Input` 描边色   | `transition: border-color`           | 保留 (纯 hover/focus 反馈, 无 JS 状态)                      |

## 落地决定 (执行后增补)

| 项                        | 决定                                                                              | 依据                                                                                                             |
| ------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 新增 `createTween`        | `src/hooks/createTween.svelte.ts`: `$effect` 把目标值同步到 `Tween`               | 5 处指示条/位移都要"目标 state -> Tween", 手抄 5 份 effect 等于复制粘贴                                          |
| `Tab` 面板                | `Tween` 进度写 `--progress`, CSS 由 `data-direction` 派生位移; 不用 `transition:` | `transition:` 由 WAAPI 驱动, happy-dom 不结算帧且卸载时 `cancel()` 抛未处理的 AbortError; 变量驱动两处环境都能跑 |
| `data-direction`          | 保留                                                                              | 它现在是"动画方向"的显式数据源, 位移公式与测试都读它                                                             |
| `Modal` 用 Tween 而非 fly | 保留 `{#if mounted}` 状态机                                                       | `dialog` 必须 `showModal()`/`close()` 才能拿到焦点与 inert 语义, 元素不能由 Svelte 的退出动画决定去留            |
| `Modal` 的 `active` 类    | 删除, 改由 `--progress` 一个变量驱动透明度和位移                                  | 类与变量同时表达"进度"必然漂移                                                                                   |
| `Tab` 指示条的补间时长    | 512ms, `bottom` 用 `linear` (与源码一致), 其余 `cubicOut`                         | 源码: bottom 是 `left 512ms linear`, top/menu/nav 是 `512ms ease`                                                |
| `Carousel` 的补间时长     | 240ms `cubicOut`                                                                  | 源码 `transform 240ms ease`                                                                                      |
| `prefers-reduced-motion`  | `DigitWheel` 里 `spring.set(..., { instant })`; 其余补间时长为 0                  | 用户要求减少动效时不应再逐帧逼近                                                                                 |

## 验收

- `npx vp test` 全绿; `npx vp check` / `svelte-check` 0 error 0 warning.
- 旧断言按新契约改写 (断言"最终位置/最终状态"而非"点击瞬间的中间值"), 不删用例.
- 真实浏览器 (playwright) 逐项确认: 面板切换、指示条跟随、弹层四向进出、`Expand` 展开收起、
  `Carousel` 翻页、`DigitWheel` 换数字.
