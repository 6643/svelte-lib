# Demo Latest Usage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `demo/` 收口为当前 `svelte-lib` builder 与 Svelte 5 的真实 consumer 示例。

**Architecture:** 保持 demo 的单一 builder 配置入口和现有组件结构。builder 单独拥有 HTML mount root, App 只渲染内容; package scripts 直接调用发布的 `svelte-build`/`svelte-dev`, `check` 使用本地声明的 `svelte-check`。

**Tech Stack:** Bun, Svelte 5, `svelte-lib`, `svelte-build`, `svelte-dev`, `svelte-check`, TypeScript。

## Global Constraints

- 不引入 Vite、Rollup 或新的 bundler。
- 不修改根包公开 API。
- 保留 `Counter.svelte` 的 `$state` 与 `onclick` 写法。
- demo 不保留重复的 `id="app"` mount root。
- 不自动 stage、commit 或 push。

---

### Task 1: Add the consumer usage contract

**Files:**
- Create: `tests/demo-latest-usage.test.ts`
- Reference: `demo/builder.ts`, `demo/src/App.svelte`, `demo/package.json`

- [x] **Step 1: Write the failing tests**

  Assert direct default config export, single builder-owned mount root, current package naming, and a `check` script with explicit Svelte tooling dependencies.

- [x] **Step 2: Run the focused test**

  Run `bun test --conditions=browser tests/demo-latest-usage.test.ts` and confirm the old helper, duplicate root, old name, and missing script fail the contract.

### Task 2: Migrate demo configuration and app root

**Files:**
- Modify: `demo/builder.ts`
- Modify: `demo/src/App.svelte`

- [x] **Step 1: Export the builder config directly**

  Replace `defineSvelteConfig({ ... })` with `export default { ... }` and keep all existing fields and values.

- [x] **Step 2: Remove duplicate mount ownership**

  Replace `<main id="app">` with a content element such as `<section class="app-shell">`; update the consumer copy from `svelte-builder` to `svelte-lib`.

- [x] **Step 3: Run the focused contract test**

  Run the same test and require all assertions to pass.

### Task 3: Make the demo consumer checks explicit

**Files:**
- Modify: `demo/package.json`
- Modify: `demo/tsconfig.json`

- [x] **Step 1: Add current scripts and dependencies**

  Keep `build` and `dev`; add `check` invoking `svelte-check`. Declare `svelte` as the runtime peer consumer and `svelte-check`/`typescript` as dev tooling. Since the demo source does not use Bun or Node ambient APIs, keep `tsconfig.json` types limited to `svelte`.

- [x] **Step 2: Run demo checks**

  Run `bun run check` and `bun run build` from `demo/`; both must exit successfully with zero Svelte diagnostics.

### Task 4: Verify the consumer workflow

**Files:**
- No additional source files.

- [x] **Step 1: Smoke the native dev server**

  Start `bun run dev` from `demo/`, fetch `/` and `/main.ts`, assert HTTP 200, then stop the child without leaving a process.

- [x] **Step 2: Run repository verification**

  Run `bun run test` from the repository root and `git diff --check`.

- [x] **Step 3: Record the result**

  Result: focused demo contract 3 pass, demo check 0 errors/0 warnings, demo build passed, dev smoke returned 200 for `/` and `/main.ts` with one `main#app`, repository test 168 pass/0 fail, root typecheck 0 errors/0 warnings, and `git diff --check` passed. Native dev remains sensitive to Bun `1.3.14` as documented by the builder.
