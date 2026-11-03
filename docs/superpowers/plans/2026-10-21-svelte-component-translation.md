# Svelte 组件库翻译 实施计划

> **For agentic workers:** 逐任务执行, 每个任务的步骤按 RED -> GREEN 顺序勾选. 计划中的
> "源" 指 `_/solid-lib/src` 下的 Solid 原文件, 实现者必须先读源文件再翻译.

**Goal:** 把 `_/solid-lib/src` 的 Solid 组件与 hooks 逐个翻译成 Svelte 5 runes 实现, 交付
可打包、有测试的组件库.

**Architecture:** 单包纯组件库; `src/lib/<Name>.svelte` 一文件一组件, 样式写在组件内
`<style>`; 非组件逻辑放 `src/lib/<name>.ts`; `src/lib/index.ts` 汇总导出; `playground/` 是
最小演示站.

**Tech Stack:** Svelte 5 (runes), Vite+ 1.3.0 (`vp`), `@sveltejs/vite-plugin-svelte`,
`@sveltejs/package`, `@testing-library/svelte`, `happy-dom`, TypeScript.

**Spec:** `docs/superpowers/specs/2026-10-21-svelte-component-library-design.md`

## Global Constraints

- 目标目录 `/home/_/._/lib/svelte`; 源目录 `/home/_/._/_/solid-lib/src`.
- 不改 `vite.config.ts` 的 `plugins` / `build.outDir` / `test` / `resolve.conditions`, 除非任务
  明确要求 (已实测: 缺 `resolve.conditions: ['browser']` 时 svelte 解析到 server 版).
- 测试从 `vite-plus/test` 导入 (`describe/it/expect/vi`), 不从 `vitest`.
- 组件内引用图标: `import { icon_xxx } from './svgicons.ts'`, 传字符串给 `SvgIcon.svelte`.
- 保留下划线命名 (`svgicons.ts` 生成物, 原样复制, 不重排不格式化).
- CSS 变量名沿用 solid: `--base-bg/fg`, `--raised-bg/fg`, `--inset-bg/fg`, `--accent-color`,
  `--error-color`, `--disabled-color`, `--overlay-color`.
- 导出面: 具名导出, 与 solid 一致 (`FilledButton`, `Block`, `SvgIcon`, ...).
- 每个任务结束必须: `npx vp check` 通过, `npx svelte-check --tsconfig ./tsconfig.json` 0 error,
  `npx vp test` 全绿.
- 禁止删除/跳过/放宽测试来通过验收.
- **不执行 git commit**: 本目录位于 `/home/_/._` 这个 dotfiles 仓库内部`, 尚未被跟踪, 向其中提交会影响用户仓库历史. 计划末尾的 “提交” 步骤一律改为 “在 ledger 写完成行”; 其它步骤不变.
- 中文注释, ASCII 标点.

## Review Focus

1. `SvgIcon` 用 `{@html svgPaths}` 注入 SVG: 传入任意字符串会被当 HTML 解析, 只接受库内
   `svgicons.ts` 常量 (XSS 面).
2. `Modal` 依赖原生 `<dialog>.showModal()`; happy-dom 有该方法但无布局, 因此关闭逻辑
   (Escape / 点遮罩) 必须靠测试断言, 不能靠肉眼.
3. `DigitWheel` / `CountDown` / `Counter` 用 setTimeout 弹簧动画与 setInterval; 卸载时必须
   清理定时器, 否则测试挂住 (`useEffect` 返回清理函数 / `onDestroy`).
4. `FlexBox` / `GridBox` / `StackBox` 在 `$effect` 里直接改子元素 inline style; 子节点变化时
   必须重跑且与 `{#each}` key 配合, 不能残留上一次的样式.
5. `CaptchaInput` 直接写 `input.value` 绕过 Svelte 的 value 绑定, 输入法/粘贴路径要断言.

---

### Task 1: 基础层 (tokens + 图标)

**Files:**

- Create: `src/lib/_.css` (从 `solid-lib/src/_.css` 原样复制)
- Create: `src/lib/svgicons.ts` (原样复制 `solid-lib/src/svgicons.ts`, 3739 行, 不改内容)
- Create: `src/lib/SvgIcon.svelte`
- Create: `src/lib/SvgIcon.test.ts`
- Modify: `src/lib/index.ts` (同时删除模板自带的 `Button.svelte` 占位)

**Interfaces (Produces):**

- `SvgIcon`: props `{ svgPaths: string; color?: string; size?: 20|24|40|48 }`, 默认 24.
- 主题变量 (供后续所有任务消费): `--base-bg/fg`, `--raised-bg/fg`, `--inset-bg/fg`,
  `--accent-color`, `--error-color`, `--disabled-color`, `--overlay-color`, 暗色由
  `[data-theme-mode="dark"]` 覆盖.

- [x] **Step 1: 复制 `_.css` 与 `svgicons.ts`**

```bash
cp /home/_/._/_/solid-lib/src/_.css /home/_/._/lib/svelte/src/lib/_.css
cp /home/_/._/_/solid-lib/src/svgicons.ts /home/_/._/lib/svelte/src/lib/svgicons.ts
```

- [x] **Step 2: 写失败的 SvgIcon 测试** `src/lib/SvgIcon.test.ts`

断言: `svgPaths` 渲染为 `<svg>` 内的 `<path>`; `size` 缺省 24; 传 `size={40}` 时
`width`/`height` 属性为 `40`; `color` 落到 CSS 变量 `--color`.

- [x] **Step 3: 运行确认失败** — Run: `npx vp test src/lib/SvgIcon.test.ts`
      Expected: FAIL, 找不到 `./SvgIcon.svelte`.

- [x] **Step 4: 实现 `SvgIcon.svelte`**

```svelte
<script lang="ts">
  let { svgPaths, color, size = 24 }: { svgPaths: string; color?: string; size?: 20 | 24 | 40 | 48 } = $props();
</script>

<svg viewBox="0 -960 960 960" width={size} height={size} style:--color={color} aria-hidden="true">
  {@html svgPaths}
</svg>
```

- [x] **Step 5: 运行确认通过** — 同 Step 3, Expected: PASS 1/1.

- [x] **Step 6: 校验**

```bash
npx vp check && npx svelte-check --tsconfig ./tsconfig.json && npx vp test
```

Expected: 三条全绿 (`svelte-check found 0 errors and 0 warnings`).

- [x] **Step 7: 写 ledger 完成行** (替代 git commit, 见 Global Constraints)

在 `.superpowers/sdd/2026-10-21-svelte-component-translation/progress.md` 追加 `Task N: complete` 行与 Ruling.

---

### Task 2: 布局与容器

**Files:**

- Create: `src/lib/Card.svelte`, `Box.svelte`, `FlexBox.svelte`, `GridBox.svelte`,
  `StackBox.svelte`, `CenterBox.svelte`, `AvatarImage.svelte`
- Create: `src/lib/layout.test.ts`
- Modify: `src/lib/index.ts`

**Consumes:** Task 1 的 `SvgIcon`, `_.css` 变量.
**Produces:** `Card`, `Block`, `FlexBox`, `GridBox`, `StackBox`, `CenterBox`, `AvatarImage`.

源: `solid-lib/src/{Card,Box,FlexBox,GridBox,StackBox,CenterBox,AvatarImage}.tsx` 与同名
`.module.css`. 翻译时把 `.module.css` 内容搬进组件 `<style>`, 类名去掉哈希.

- [x] **Step 1: 写失败测试** `layout.test.ts`, 覆盖:
      `Block` 在给 `headerTitle` 时渲染标题, 不给时不渲染; `Block` 在 `footerLeft` 时渲染 footer;
      `CenterBox` 把 `w/h` 写成 `--w`/`--h`; `AvatarImage` 对 `color="blue"` 产出 `#00AEEC`;
      `FlexBox` 给 `gap={8}` 时容器 `--gap` 为 8; `GridBox` 的 `areas` 字符串转换成
      `"_a _b"` 形式; `StackBox` 给 `pos=[{x:10,y:-5}]` 时子元素内联 `--left:10px` 与
      `--bottom:5px`; `Card` 透传 `class`.
- [x] **Step 2: 运行确认失败** — `npx vp test src/lib/layout.test.ts` → FAIL (模块不存在).
- [x] **Step 3: 逐个翻译 7 个组件**
- [x] **Step 4: 运行确认通过** — 同 Step 2, Expected: PASS.
- [x] **Step 5: 校验** — `npx vp check && npx svelte-check --tsconfig ./tsconfig.json && npx vp test`
- [x] **Step 6: 写 ledger 完成行** (替代 git commit, 见 Global Constraints)

在 `.superpowers/sdd/2026-10-21-svelte-component-translation/progress.md` 追加 `Task N: complete` 行与 Ruling.

---

### Task 3: 按钮族

**Files:**

- Modify: `src/lib/Button.svelte` (占位 -> 完整), `src/lib/Button.test.ts`
- Modify: `src/lib/index.ts`

**Consumes:** Task 1 `SvgIcon`.
**Produces:** `IconButton`, `TextButton`, `FilledButton`, `OutlinedButton`, 类型
`ButtonTapHandler`, `IconButtonProps`, `TextButtonProps`, `FilledButtonProps`,
`OutlinedButtonProps`. 不导出 `Button`.

源: `solid-lib/src/Button.tsx` + `Button.module.css`.

- [x] **Step 1: 写失败测试** (替换 `Button.test.ts`), 覆盖:
      `IconButton` 渲染 `svg` 且 `tap` 被调用一次; `tap` 返回 Promise 期间
      `disabled` 为 true (防连点), resolve 后恢复; `TextButton` 有 `text` 时渲染文字,
      有 `icon` 时同时渲染 `svg`; `FilledButton` 的 `bgColor`/`borderRadius` 落到
      `--bg`/`--radius`; `OutlinedButton` 渲染 `outlined` 类; `disabled` 时不触发 `tap`.
- [x] **Step 2: 运行确认失败** — `npx vp test src/lib/Button.test.ts` → FAIL.
- [x] **Step 3: 实现四个组件** — 注意: `onMouseDown` 需要 `preventDefault` 保持
      solid 的 "点击不夺焦" 行为; 点击完成后把同容器内 `input/textarea` 重新 `focus()`
      (solid 用 `closest('[class*="inputWrap"]')`, Svelte 版改为
      `el.closest('.input-wrap')`, 并在 Task 5 的 Input 里使用该类名).
- [x] **Step 4: 运行确认通过**
- [x] **Step 5: 校验** — 三条命令
- [x] **Step 6: 写 ledger 完成行** (替代 git commit, 见 Global Constraints)

在 `.superpowers/sdd/2026-10-21-svelte-component-translation/progress.md` 追加 `Task N: complete` 行与 Ruling.

---

### Task 4: 展示类组件

**Files:**

- Create: `src/lib/DigitWheel.svelte`, `CountDown.svelte`, `Counter.svelte`,
  `TimeLine.svelte`, `ImagePlayer.svelte`
- Create: `src/lib/display.test.ts`
- Modify: `src/lib/index.ts`

**Consumes:** Task 3 `IconButton`.
**Produces:** `DigitWheel`, `CountDown`, `Counter`, `TimeLine`, `ImagePlayer`.

源: `solid-lib/src/{DigitWheel,CountDown,Counter,TimeLine,ImagePlayer}.tsx`.

- [x] **Step 1: 写失败测试** `display.test.ts` (`vi.useFakeTimers`), 覆盖:
      `Counter` 初值 3 渲染 3 位数字轮, 点 + 变 4, 触顶 `max` 不再增加, 触底 `min` 不再减少;
      `CountDown` 传 `value={2}` 时 `done` 恰好被调用一次 (推进 3 秒); `CountDown` 卸载后
      定时器不再 tick (组件销毁立即断言); `TimeLine` 超过 `visCount` 时显示展开按钮, 点击后
      显示全部条目; `ImagePlayer` 两倍图片用于无缝滚动, `duration`/`height` 落到 CSS 变量.
- [x] **Step 2: 运行确认失败** — `npx vp test src/lib/display.test.ts` → FAIL.
- [x] **Step 3: 实现 5 个组件** — `DigitWheel` 的弹簧动画用 `$effect` + `setTimeout`,
      必须返回清理; `CountDown` 的 `setInterval` 在 `onDestroy` 清理.
- [x] **Step 4: 运行确认通过**
- [x] **Step 5: 校验** — 三条命令
- [x] **Step 6: 写 ledger 完成行** (替代 git commit, 见 Global Constraints)

在 `.superpowers/sdd/2026-10-21-svelte-component-translation/progress.md` 追加 `Task N: complete` 行与 Ruling.

---

### Task 5: 交互组件 (Modal / Expand / Carousel)

**Files:**

- Create: `src/lib/Modal.svelte`, `Expand.svelte`, `Carousel.svelte`
- Create: `src/lib/interactive.test.ts`
- Modify: `src/lib/index.ts`

**Consumes:** Task 3 `IconButton`.
**Produces:** `BottomModal`, `TopModal`, `LeftModal`, `RightModal` (props
`{ open, onClose?, width?, height?, ariaLabel?, class?, children }`), `Expand`, `Carousel`.

源: `solid-lib/src/{Modal,Expand,Carousel}.tsx`.

- [x] **Step 1: 写失败测试** `interactive.test.ts`, 覆盖:
      `open=false` 时 DOM 无 `dialog`; `open=true` 后出现 `dialog[open]`; 按 Escape 调
      `onClose` 一次; 点击 `dialog` 背景 (非 `.content`) 调 `onClose`; `Expand` 初始不渲染
      内容, 点标题后渲染内容且加 `active` 类; `Carousel` 点下一张时 `changed` 收到 1,
      在末张点下一张回到 0 (取模), 图片 `src` 与 `alt` 正确.
- [x] **Step 2: 运行确认失败** — `npx vp test src/lib/interactive.test.ts` → FAIL.
- [x] **Step 3: 实现 3 个组件** — Modal 用原生 `<dialog>` + `showModal()`; Svelte 无
      `Portal`, 组件内直接渲染 `<dialog>` 即可 (dialog 顶层渲染语义已满足).
- [x] **Step 4: 运行确认通过**
- [x] **Step 5: 校验** — 三条命令
- [x] **Step 6: 写 ledger 完成行** (替代 git commit, 见 Global Constraints)

在 `.superpowers/sdd/2026-10-21-svelte-component-translation/progress.md` 追加 `Task N: complete` 行与 Ruling.

---

### Task 6: 表单组件

**Files:**

- Create: `src/lib/Field.svelte` (从 `Input.tsx` 内部的 `Input` 包装组件翻译, 承载
  label / 校验文案 / 左右插槽), `RangeInput.svelte`, `TextInput.svelte`, `TextArea.svelte`,
  `PasswordInput.svelte`, `NumberInput.svelte`, `EmailInput.svelte`, `TelInput.svelte`,
  `CheckButton.svelte`, `RadioButton.svelte`, `CaptchaInput.svelte`
- Create: `src/lib/form.test.ts`
- Modify: `src/lib/index.ts`

**Consumes:** Task 3 `IconButton`.
**Produces:** 上述 11 个组件. `Field.svelte` 的输入容器元素带类名 `input-wrap`, 因为
Task 3 的按钮在点击后靠 `closest('.input-wrap')` 找回焦点; `Field` 同时提供
`error` 类名与 `.field-error` 文案节点供测试断言.

源: `solid-lib/src/Input.tsx` + `Input.module.css`.

- [x] **Step 1: 写失败测试** `form.test.ts`, 覆盖:
      `TextInput` 输入触发 `changed` 且值反映到 `input.value`; `TextInput` 的
      `validate` 返回字符串时渲染错误文案并加错误类; `validate` 返回 Promise 时先渲染
      "校验中...", resolve 后替换; `NumberInput` 点 + / - 在 `min`/`max` 处夹紧;
      `RangeInput` 拖到新值触发 `changed`; `EmailInput` 输入非法邮箱给出默认错误文案;
      `CheckButton` / `RadioButton` 切换触发 `changed`;
      `CaptchaInput` 粘贴 `a1b2c3d4` 且 `length=6` 得到 `a1b2c3`; 删除键回退一位.
- [x] **Step 2: 运行确认失败** — `npx vp test src/lib/form.test.ts` → FAIL.
- [x] **Step 3: 实现组件** — 逐文件翻译; `useField` 的异步校验竞态用递增序号守卫
      (与源一致).
- [x] **Step 4: 运行确认通过**
- [x] **Step 5: 校验** — 三条命令
- [x] **Step 6: 写 ledger 完成行** (替代 git commit, 见 Global Constraints)

在 `.superpowers/sdd/2026-10-21-svelte-component-translation/progress.md` 追加 `Task N: complete` 行与 Ruling.

---

### Task 7: 滚动与列表 hooks + 列表组件

**Files:**

- Create: `src/lib/createDebounce.ts`, `useScrollEnd.ts`, `useKeepScroll.ts`, `useLoad.ts`
- Create: `src/lib/ListBox.svelte`, `SortListBox.svelte`, `LoadMore.svelte`,
  `CityPicker.svelte`
- Create: `src/lib/list.test.ts`, `src/lib/scroll-hooks.test.ts`
- Modify: `src/lib/index.ts`

**Consumes:** Task 6 `TextInput` (SortListBox 的过滤框, 若源用到).
**Produces:** `createDebounce(fn, wait) -> ((...args) => void) & { cancel() }`;
`useScrollEnd(el, hook, ms?) -> void`; `setPos/getPos/delPos` + `useKeepScroll(el, page, key, ms?)`;
`useLoad(el, more, args, threshold?) -> { load, reset }`; `ListBox`, `SortListBox`, `LoadMore`,
`initCities(path) -> Promise<void>`, `CityPicker`.

`LoadMore` 在 solid 里是一个返回 JSX 的工厂函数, 编译到 Svelte 后改为组件:
props `{ api: (page: number, args?: T) => Promise<boolean>; args?: T; threshold?: number }`,
用一个 `.svelte.ts` 模块级的 `loadMoreReset` 回调向外暴露 `reset` (测试直接 import 它),
不引入 `bind:this` 命令式 API.

源: `solid-lib/src/{createDebounce,useScrollEnd,useKeepScroll,useLoad,ListBox,SortListBox,LoadMore,CityPicker}.ts(x)`.
`CityPicker` 的 `vis: Signal<boolean>` 参数在 Svelte 版改为 `open: boolean` + `onOpenChange`
回调 (Svelte 无双向 Signal), 面包屑与 `code < 100000` 的中间层判定保持不变.
Svelte 版 hook 签名改为 `(getEl: () => HTMLElement | undefined, ...)` 并在内部用
`$effect` 订阅元素, 不再需要 solid 的 `runWithOwner`.

- [x] **Step 1: 写失败测试** `scroll-hooks.test.ts`: `createDebounce` 合并连续调用,
      `cancel()` 后不再触发; `useScrollEnd` 在滚动后按 debounce 回调一次 (fake timers);
      `setPos/getPos/delPos` 往返; `useLoad` 在距底 `< threshold` 时调用 `more(0)` 并在成功
      后 page 递增; `more` 返回 false 后不再调用.
- [x] **Step 2: 运行确认失败** — `npx vp test src/lib/scroll-hooks.test.ts` → FAIL.
- [x] **Step 3: 实现 4 个 hook**
- [x] **Step 4: 运行确认通过**
- [x] **Step 5: 写失败测试** `list.test.ts`: `ListBox` 按 `items` 渲染可见行 (窗口化,
      不渲染全部); `filter` 生效; 点击行触发 `changed(index)`; `SortListBox` 能按拖拽顺序
      输出重排结果 (源实现以 touch/pointer 事件驱动, 用 pointer 事件断言);
      `LoadMore` 触发 `api(page)`; `CityPicker` 给 `open` 时拉取 `url` 并渲染一级城市,
      点 `code < 100000` 的城市进入下一级且不关闭, 点末级城市触发 `change` 并请求关闭.
- [x] **Step 6: 运行确认失败** — `npx vp test src/lib/list.test.ts` → FAIL.
- [x] **Step 7: 实现 4 个列表组件**
- [x] **Step 8: 运行确认通过** — `npx vp test`
- [x] **Step 9: 校验** — 三条命令
- [x] **Step 10: 写 ledger 完成行** (替代 git commit, 见 Global Constraints)

在 `.superpowers/sdd/2026-10-21-svelte-component-translation/progress.md` 追加 `Task N: complete` 行与 Ruling.

---

### Task 8: 标签页 (5 个) + 主题

**Files:**

- Create: `src/lib/themeMode.ts`, `themeAccent.ts`, `Theme.svelte`
- Create: `src/lib/BottomTab.svelte`, `TopTab.svelte`, `LeftTab.svelte`, `MenuTab.svelte`,
  `NavTab.svelte`
- Create: `src/lib/theme.test.ts`, `src/lib/tabs.test.ts`
- Modify: `src/lib/index.ts`

**Consumes:** Task 3 `IconButton`, Task 7 `useKeepScroll`/`getPos`/`setPos`/`createDebounce`.
**Produces:** `initTheme`, `useTheme`, `initAccent`, `useAccent`, `ThemeSwitch`, `AccentSelector`,
`ThemeToggle`, `AccentPicker`, `getThemeMode`, `getResolvedThemeMode`, `setThemeMode`,
`initializeThemeMode`, `setSystemTheme`, `setLightTheme`, `setDarkTheme`, 类型 `ThemeMode`;
`BottomTab`, `TopTab`, `LeftTab`, `MenuTab`, `NavTab`.

源: `solid-lib/src/{Theme.tsx,themeMode.ts,themeAccent.ts,{Bottom,Top,Left,Menu,Nav}Tab.tsx}`.
注意本库 `themeMode` 的存储 key 改为 `svelte-lib:theme-mode` (与原库区分), 其余逻辑一致.

- [x] **Step 1: 写失败测试** `theme.test.ts`: `initTheme()` 设置
      `documentElement[data-theme-mode]`; `setDarkTheme()` 后属性为 `dark` 且落 localStorage;
      `setSystemTheme()` 跟随 `matchMedia('(prefers-color-scheme: dark)')` 的 change 事件;
      `initAccent()` 设置 `--accent-color`; `useAccent()` 设置后同步 DOM.
- [x] **Step 2: 运行确认失败** → FAIL.
- [x] **Step 3: 实现主题三文件 + `Theme.svelte`**
- [x] **Step 4: 运行确认通过**
- [x] **Step 5: 写失败测试** `tabs.test.ts`: 每个 Tab 组件点第二项后渲染对应面板, 第一项
      面板消失; `MenuTab` 指示条 `--left`/`--width` 跟随当前项; `NavTab` 点导航项后
      `main` 平移到对应子元素.
- [x] **Step 6: 运行确认失败** → FAIL.
- [x] **Step 7: 实现 5 个 Tab 组件**
- [x] **Step 8: 运行确认通过** — `npx vp test`
- [x] **Step 9: 校验** — 三条命令
- [x] **Step 10: 写 ledger 完成行** (替代 git commit, 见 Global Constraints)

在 `.superpowers/sdd/2026-10-21-svelte-component-translation/progress.md` 追加 `Task N: complete` 行与 Ruling.

---

### Task 9: 其余工具与 hooks

**Files:**

- Create: `src/lib/createCopy.ts`, `createFullscreen.ts`, `createOnce.ts`, `createStorage.ts`,
  `createThrottle.ts`, `createTime.ts`, `createDebouncedSignal.svelte.ts`, `readEl.ts`,
  `useClass.ts`, `useClickOutside.ts`, `useFilePicker.ts`, `useGestures.ts`, `useHttp.ts`,
  `useImgScale.ts`, `useKeyPress.ts`, `useMediaQuery.svelte.ts`, `useMutation.ts`,
  `useRefresh.ts`, `useResize.ts`, `useVis.ts`, `useWakeLock.svelte.ts`, `createTry.svelte.ts`,
  `TryCatch.svelte`
- Create: `src/lib/utils.test.ts`
- Modify: `src/lib/index.ts`

**Produces:** 与 solid `_.ts` 对应的全部具名导出 (`createCopy`, `createFullscreen`,
`createOnce`, `createStorage`, `createThrottle`, `getChinaTimestamp`, `createTry`, `useClass`,
`useClickOutside`, `useFilePicker`, `useTap`, `useLongPress`, `createHttp`, `http`,
`useImgScale`, `useKeyPress`, `useMediaQuery`, `useMutation`, `useRefresh`, `useResize`,
`useVis`, `useWakeLock`, `getPos`, `setPos`, `delPos`).

源: `solid-lib/src/` 中列出的同名文件 (含 `createTry.tsx`). `createTry` 拆成两个产物:
`createTry.ts` 导出纯逻辑 `createTry(): { tryCatch, errors, clearErrors }`
(`errors` 是 `$state` 数组, 在 `.svelte.ts` 里声明以保持响应), 以及
`TryCatch.svelte` 负责错误列表展示 (替代原 `TryCatch` 组件字段). 计划不导出
`TryCatch` 函数字段, 导出组件 `TryCatch`; 这是相对 solid 的一处 API 差异, 已在
`index.ts` 注释里标明.

- [x] **Step 1: 写失败测试** `utils.test.ts`, 覆盖纯逻辑部分:
      `createStorage` 读写 localStorage 并回落默认值; `createOnce` 只执行一次;
      `createThrottle` 首次立即执行, 窗口内忽略; `getChinaTimestamp` 返回 `YYYY-MM-DD HH:mm:ss`
      形态; `createCopy` 调用 `navigator.clipboard.writeText` 并置真 1.5 秒后回落;
      `useMediaQuery` 返回随 `matchMedia` change 变化的值; `useClass` 叠加/移除 class;
      `createTry` 捕获同步 throw 与 rejected promise, 两者都进入 `errors` 且不向外抛.
- [x] **Step 2: 运行确认失败** → FAIL.
- [x] **Step 3: 实现 22 个模块** — DOM 相关 hook 统一签名 `(el: () => HTMLElement | undefined, ...)`,
      内部 `$effect` 订阅并在销毁时移除监听.
- [x] **Step 4: 运行确认通过** — `npx vp test`
- [x] **Step 5: 校验** — 三条命令
- [x] **Step 6: 写 ledger 完成行** (替代 git commit, 见 Global Constraints)

在 `.superpowers/sdd/2026-10-21-svelte-component-translation/progress.md` 追加 `Task N: complete` 行与 Ruling.

---

### Task 10: 演示站、导出收口与全量验收

**Files:**

- Modify: `src/lib/index.ts` (与 solid `_.ts` 完整对齐, 含分组注释)
- Modify: `playground/App.svelte` (逐类挂载组件, 供人工目测)
- Modify: `README.md` (目录、命令、组件清单、Solid 对照表)

- [x] **Step 1: 收口 `index.ts`** — 按 solid `_.ts` 的分组导出; 覆盖率检查:
      `grep -c "^export" src/lib/index.ts` 与 `solid-lib/src/_.ts` 的导出条目数量对齐 (允许
      多出 `_.css` 之外的差异, 但不得少).
- [x] **Step 2: 写失败测试** `src/lib/public-api.test.ts`, 断言
      `import * as lib from './index.ts'` 后每个预期符号都为 `function`/`object` (逐个列出
      名字, 与 `_.ts` 对应).
- [x] **Step 3: 运行确认失败/通过** — 若已通过, 在报告里标注 "API 测试在收口前已通过"
      (说明它是回归护栏而非驱动测试).
- [x] **Step 4: 演示站挂载** — `playground/App.svelte` 按分组渲染所有组件 (数据用内联常量).
- [x] **Step 5: 全量验收**

```bash
npx vp check
npx svelte-check --tsconfig ./tsconfig.json
npx vp test
npx vp build
pnpm run prepack
```

Expected: check 两条 pass; svelte-check 0 error 0 warning; test 全绿; build 产出
`build/index.html`; prepack 输出 publint `All good!`, `dist/` 含 `index.js`、`index.d.ts`、
每个组件的 `.svelte` 与 `.svelte.d.ts`.

- [x] **Step 6: 写 ledger 完成行** (替代 git commit, 见 Global Constraints)

在 `.superpowers/sdd/2026-10-21-svelte-component-translation/progress.md` 追加 `Task N: complete` 行与 Ruling.
