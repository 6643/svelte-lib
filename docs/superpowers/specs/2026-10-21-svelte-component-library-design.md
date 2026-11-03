# Svelte 组件库 (方案)

日期: 2026-10-21
目标目录: `/home/_/._/lib/svelte` (Vite+ 驱动)

## 目标

把 `_/solid-lib/src` 的 Solid 实现逐个翻译成 Svelte 5 (runes) 组件与 hooks, 交付一个
可 `svelte-package` 打包、有测试、有本地演示页的纯组件库.

## 非目标

- `solid-lib/src/Route.ts` 后续追加翻译 (见下方"追加项"), 作为 `svelte-components/route` 子路径导出.
- 不翻译 `solid-lib` 的 demo 站点结构; 只保留一个最小 demo.
- 不做构建器 (`svelte-lib/src/builder`).

## 追加项 (用户决定, 计划完成后补做)

- 翻译 `solid-lib/src/Route.ts` -> `src/route.svelte.ts` (状态机) + `src/Route.svelte` (组件) +
  `src/route.ts` (子路径入口). 对应 solid 的 `solid-lib/route` 子路径, 不混进 `index.ts` 的
  UI 分组 (只在末尾补一次再导出).

## 已定事项 (用户决定)

- 工具链: Vite+ 1.3.0 (`vp dev/build/check/test/fmt/lint`), pnpm catalog + override 把
  `vite` 指到 `@voidzero-dev/vite-plus-core`.
- 仓库形态: 纯组件库, 无 SvelteKit; 库产物 `dist/` 由 `svelte-package` 生成, 演示站产物
  在 `build/`.
- 翻译粒度: 逐个源文件, Solid 原语 -> Svelte runes, 保留原有语义与视觉.

## 我的判断 (可推翻)

- ~~**API 忠实移植**: 保留 solid 的具名导出 (`FilledButton` / `IconButton` / ...)~~
  **已推翻 (用户决定)**: 四组组件各合并为单一组件 —— 四个按钮 `<Button mode>`,
  四个弹层 `<Modal mode>`, 十个输入控件 `<Input mode>` (源 `Input.tsx` 的 10 个导出),
  五个 Tab `<Tab mode>` (Bottom/Top/Left/Menu/Nav). 理由: 每组都只是同一个 base/外壳
  传不同 class, 没有独立逻辑; 合并后一处契约, 少 23 个转发文件. 其余符号仍 1:1 保留.
- **CSS 变量沿用 solid 名**: `--inset-bg/fg`, `--raised-bg/fg`, `--base-bg/fg`,
  `--accent-color`, `--error-color`, `--disabled-color`. 理由: 组件 CSS 可近乎逐行移植,
  降低翻译出错面. `svelte-lib` 的 `--sunken-*` 差异留到合并时统一.
- **样式随组件** (Svelte 原生 `<style>`), 不放 `.module.css`. 理由: Svelte 组件级作用域已
  提供隔离, `styles.foo` + `svelte-package` 需要额外产物处理.
- **测试用 `@testing-library/svelte` + happy-dom**. 已在 `vite.config.ts` 配置
  `test.environment = 'happy-dom'` 与 `resolve.conditions = ['browser']` (缺后者时
  `svelte` 会解析到 server 版 `mount`, 已实测复现).

## Solid -> Svelte 映射约定

| Solid                                        | Svelte 5                                                          |
| -------------------------------------------- | ----------------------------------------------------------------- |
| `createSignal(x)`                            | `let v = $state(x)` / `$derived`                                  |
| `createEffect(fn)`                           | `$effect(() => {...})`                                            |
| `createMemo(fn)`                             | `$derived(...)`                                                   |
| `onSettled` / `onMount`                      | `$effect` / `onMount`                                             |
| `Show when={}`                               | `{#if}`                                                           |
| `For each={}`                                | `{#each}` (key: `(item)` 或 `(item, i)`)                          |
| `children: Element`                          | `children: Snippet` + `{@render children()}`                      |
| `props.children` 逐项函数                    | `children: Snippet<[T, number]>`                                  |
| `Portal`                                     | `svelte` 无内置; 用 `<dialog>` 本身或 `document.body` 挂载 helper |
| `Element.prototype.style.setProperty` 副作用 | `$effect` 里操作 DOM, 或 `style:--x={}`                           |

## 交付验收

1. `vp check` 通过 (oxfmt + oxlint typeAware/typeCheck).
2. `svelte-check` 0 error.
3. `vp test` 全绿; 每个组件至少一条渲染/交互断言.
4. `vp build` 出演示站, `npm run prepack` 出 `dist/` 且 publint "All good".
5. `src/index.ts` 导出全部翻译对象.
