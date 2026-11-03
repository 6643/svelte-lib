# CSS 动画改 Svelte 动画 实施计划

> **For agentic workers:** 按任务顺序执行, 每个任务以自己的测试收尾.

**Goal:** 组件里由 `<style>` 驱动的动效, 改由 `svelte/transition` 与 `svelte/motion` 驱动.

**Architecture:** 目标值仍是 `$state`; 由 `createTween` 把目标补间成读得到当前帧的 `Tween`;
入场/退场由 `{#if}` + `in:fly` 表达; 无状态无限循环 (`breathe` / 跑马灯 / refresh loading)
留在 CSS, 理由与 TODO 写进 spec 与代码注释.

**Spec:** `docs/superpowers/specs/2026-10-23-css-animation-to-svelte-motion-design.md`

## Global Constraints

- 禁止删/跳过/放宽测试来通过验收; 断言跟随新契约改写.
- 视觉结果与 CSS 变量名不变; 时长意图不变 (512 / 256 / 240ms).
- 中文注释, ASCII 标点; 契约变化同步 README.
- happy-dom 下 `element.animate()` 不触发 `finish`, 因此 `transition:` 只用于"旧节点立即卸载"的入场;
  退场卸载必须由显式状态机 (Tween 完成) 驱动.

### Task 1: `createTween` 补间工厂

**Files:**

- Create: `src/hooks/createTween.svelte.ts`, `test/fixtures/TweenProbe.svelte`, `src/hooks/motion-hooks.test.ts`
- Modify: `src/index.ts`, `src/public-api.test.ts`

**Interfaces:** `createTween(target: () => number, { duration?, easing? }) => Tween<number>`

- [x] Step 1: 写失败测试 (目标跟随 / 中途改目标 / duration=0 立即到位)
- [x] Step 2: 实现工厂 (含 unmount 时中止补间)
- [x] Step 3: 导出并补公开符号表

### Task 2: `DigitWheel` 用 `Spring` (已完成)

- [x] 删除自写 `setTimeout` 弹簧与 `timer` 状态, 改 `Spring`; 保留首帧瞬移与跨圈方向逻辑.

### Task 3: `Carousel` 位移

- [x] 测试: 点 next 后先断言中间值 (0 < offset < 100), 推进假表后断言 100
- [x] 实现: `createTween(() => index * 100, { duration: 240 })`, 删除 CSS `transition`

### Task 4: `Modal` 位移 + 透明度

- [x] 测试: `open` 置 false 后, 假表推进 400ms, dialog 卸载 (原断言不变)
- [x] 实现: `--progress` 由 Tween 驱动, 卸载时机用 `set()` 的 Promise,
      删除 `animating` 类与全部 `transition`; 遮罩透明度也改由 `--progress` 派生
- [x] 首帧从 0 起补: "挂载即 open" 也会滑入, 不会突然出现

### Task 5: `Expand` 展开收起

- [x] 实现: `{#if visible}` + `in:fly` / `out:fly`, 删除 400ms 守卫与 keyframes
- [x] 测试: 断言 `active` 类与内容挂载 (happy-dom 里退场元素不卸载, 见约束);
      退场与"收起中途再展开"用 playwright 在真实浏览器验证

### Task 6: `Tab` 面板切换 + 5 种指示条

- [x] 测试: 指示条变量先断言中间值, 推进假表 (600ms) 后断言目标值
- [x] 实现: 面板改用 `Tween` 进度 + `--progress` 变量 (不用 `in:fly`, 理由见 spec 落地决定);
      指示条位置/尺寸/旋转改 `createTween` (bottom 用 linear, top/left/menu/nav 用 cubicOut)
- [x] 删除 4 个 keyframes、全部指示条 `transition` 与 3 处 `transition-duration`;
      仅保留按钮颜色反馈 (无状态)

### Task 7: 文档与验收

- [x] README: 新增「动画」一节 + `createTween` 入 hooks 表
- [x] `npx vp check` (双 pass) / `svelte-check` (0 error 0 warning) / `vp test` (237 passed) /
      `vp build` / `prepack` (publint All good)
- [x] playwright 真实浏览器确认: `Expand` 进出场、`Modal` 四向进出场、`Tab` 五种形态的
      面板与指示条、`Carousel` 翻页、`DigitWheel` 换数字; console 0 error

## 落地结果 (执行后增补)

| 项                            | 结果                                         | 代价 / 说明                                                                                                     |
| ----------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| 测试基础设施                  | 新增 `test/setup.ts` + `test/motionQueue.ts` | `svelte/motion` 的 RAF 队列是模块级的, 上一个用例残留的任务会让下一个用例在假表里排不到驱动帧; 收尾统一清空队列 |
| `svelte/internal/client` 类型 | 新增 `test/svelte-internal.d.ts`             | 该子路径没有发布类型, 测试只读 `raf.tasks`                                                                      |
| `Tab` 面板                    | 用 `Tween` 进度而不是 `in:fly`               | `transition:` 在 happy-dom 下不结算帧、卸载还会抛未处理的 `AbortError`; 用变量驱动可以同时满足单测与浏览器      |
| `Expand`                      | 用 `in:fly` / `out:fly`                      | 该组件本来就是"旧内容退场后再卸载", 语义与 `transition:` 完全一致                                               |
| `Expand` 中途反向             | 真实浏览器确认可以打断并反向                 | `in:`/`out:` 由 Svelte 自己处理打断, 不再需要手写守卫                                                           |
| `Modal` 首帧                  | 从 0 起补                                    | 之前"挂载即 open"是直接显示, 现在会滑入; 视觉更一致                                                             |
