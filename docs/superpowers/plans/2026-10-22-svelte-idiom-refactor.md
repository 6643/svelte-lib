# 去 Solid 化重构 实施计划

> **For agentic workers:** 按任务顺序执行, 每个任务以自己的测试收尾. 步骤用 `- [ ]` 跟踪.

**Goal:** 把 28 个组件 + 27 个 hook/util 的对外契约从 Solid 范式换成 Svelte 5 母语.

**Architecture:** 值用 `$bindable` 双向绑定; 元素副作用用 `{@attach}`; 自定义 CSS 变量用 `style:--x`;
不带 rune 的 hook 退回普通 `.ts`. 旧的 `changed` / `getEl` / `tap` / `toStyleString` 全部删除, 不做兼容层.

**Tech Stack:** Svelte 5.57 runes, Vite+ 1.3, vite-plus/test, happy-dom.

**Spec:** `docs/superpowers/specs/2026-10-22-svelte-idiom-refactor-design.md`

## Global Constraints

- 禁止删/跳过/放宽测试来通过验收; 断言跟着新契约改写, 不是删掉.
- 中文注释, ASCII 标点; 契约变化同步 README 与 spec.
- 视觉与 CSS 变量名不变 (`--base-bg` 等).
- `route` 子路径的状态机语义不变; `parseParam` 仍返回 accessor.

## Review Focus

- 未绑定 (`bind:` 缺失) 时 `$bindable` 的本地回退是否仍然工作 (输入不应丢字).
- 附件重跑时机: 只有调用点读到的状态变化才重挂, 无关状态变化不得重挂.
- 单选 `bind:group` 在 `Input mode="radio"` 上的互斥与回写.
- 受控 `index` 被父级改回时, 组件不得回环反弹.
- 附件卸载时必须移除监听/观测器, 不能泄漏.

---

### Task 1: 元素类 hook 改成 attachment

**Files:**

- Rewrite: `src/hooks/{useClickOutside,useGestures,useMutation,useResize,useVis,useScrollEnd,useKeepScroll,useRefresh}.ts`
- Delete: `src/hooks/useClass.ts`, `src/hooks/useMediaQuery.svelte.ts`

**Interfaces:**

- `useClickOutside(handler, {enabled?}) => Attachment<Element>`
- `useTap(onTap, opts) / useLongPress(onLongPress, opts) => Attachment<HTMLElement>`
- `useMutation(callback, init?) / useResize(callback) / useVis(callback) => Attachment<HTMLElement>`
- `useScrollEnd(hook, debounceMs?) => Attachment<HTMLElement>`
- `useKeepScroll(page, key, debounceMs?) => Attachment<HTMLElement>`
- `useRefresh(refresh) => Attachment<HTMLElement>`

- [x] 重写 8 个文件为 `(args) => (el) => cleanup`
- [x] 删除 `useClass` / `useMediaQuery`
- [x] 组件改用 `{@attach}`, `svelte-check` 通过

### Task 2: 状态类 hook 改成读写对象

**Files:**

- Rewrite: `src/hooks/{createLoad.svelte.ts,createStorage.svelte.ts,createCopy.svelte.ts,createDebouncedSignal.svelte.ts,createFullscreen.svelte.ts,useWakeLock.svelte.ts}`
- Delete: `src/hooks/useLoad.svelte.ts`, `src/utils/readEl.ts`, `src/utils/styleVars.ts`

**Interfaces:**

- `createLoad(more, getArgs)` → `{ load(), reset(el?), page, hasMore, loading }`
- `useLoadMore(api, threshold?) => Attachment<HTMLElement>`
- `createStorage(key, initial, storage?)` → `{ value }` (get/set)
- `createCopy()` → `{ copied, copy(data) }`
- `createDebouncedSignal(source, ms)` → `{ current }`
- `createFullscreen()` → `{ isFullscreen, toggle() }`
- `useWakeLock()` → `{ supported, active, setActive(v) }`

### Task 3: Button `tap` → `onclick`

- [x] `buttonTypes.ts`: `tap` 改名 `onclick`, 类型 `(event: MouseEvent) => unknown`
- [x] `Button.svelte` 与全部调用点

### Task 4: Input 双向绑定

- [x] `inputTypes.ts`: 去掉 `changed`, 每模式 `value`/`checked`/`group` 改为 bindable, 新增 `readonly`
- [x] `Input.svelte`: 删 `lastExternal` 镜像与 `readonly={!changed}`
- [x] `Field.svelte`: `value` 由模式自身提供, 保持只读消费

### Task 5: 其余组件双向绑定

- [x] `Carousel`: `index` bindable, 删 `changed`
- [x] `ListBox`: `index` bindable, 删 `changed`
- [x] `Counter`: `value` bindable, 删 `change`
- [x] `CityPicker`: `open`/`cityCode` bindable, `change`→`onselect`, 删 `onOpenChange`
- [x] `SortListBox`: `items` bindable, 删 `hookChange`, 加 `onreorder`
- [x] `Modal`: `open` bindable
- [x] `LoadMore`: `export function reset()` + `bind:this`, 删 `onReady`
- [x] `CountDown`: `done` → `onDone`
- [x] `Tab`: 保持 `key` 记忆, 不给 `activeIndex` 加 bindable (破坏滚动记忆)

### Task 6: CSS 变量改用 `style:` 指令

- [x] 11 处 `toStyleString(...)` → `style:--x={v}`
- [x] `FlexBox`/`GridBox` 的 `style` 透传改成字符串
- [x] 删 `toStyleString`

### Task 7: 测试 / fixtures / demo / 文档

- [x] 20 个测试文件改断言到新契约
- [x] fixtures 改绑: `bind:value` 等
- [x] `demo/App.svelte` 改用法
- [x] README 差异表 + 已知限制; spec 增补
- [x] `vp check` / `svelte-check` / `vp test` / `vp build` / `prepack` 全绿
- [x] 浏览器复核

## 执行结果

7 个任务全部完成, 另有执行期新增项:

- `useMediaQuery` → `createMediaQuery` (基于 `svelte/reactivity` 的 `MediaQuery`)
- `useTheme` / `useAccent` → 模块级单例 `theme` / `accent`
- `useWakeLock` → `createWakeLock`
- `useFilePicker` / `useImgScale` → `pickFile` / `scaleImage`
- `Tab` 的 `onIndexChange` → `onchange`
- `Input mode="range"` 也走 `bind:value`
- `history.state` 键 → `__svelte_route__`, 滚动缓存键 → `svelte-route:scroll`

验收: `vp check` 0/0, `svelte-check` 0 errors 0 warnings, `vp test` 230 passed (20 files),
`vp build` 成功, `prepack` publint All good; Chrome 实测双向绑定/单选组/五个 tab 模式/
Modal 关闭/主题与强调色持久化.

踩坑记录: `useLoadMore` 若在附件里自动补首页 (读 page → load → 改 page),
会触发 `effect_update_depth_exceeded`; 已改为与源实现一致, 由外部调 `reset()`.
