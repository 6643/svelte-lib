# Bun Svelte Plugin Pipeline Implementation Plan

> The earlier SSE-only dev boundary in this plan is superseded by `2026-07-22-native-bun-hmr.md`, which integrates Bun fullstack HMR after the browser capability gate passed.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不引入 Vite 的前提下, 让生产构建和开发构建共享 Bun plugin 形式的 Svelte 编译接入, 并以 Bun bundler 替换当前 dev 的重复编译链路。

**Architecture:** Svelte compiler 仍然是底层实现, 不修改 `svelte/compiler`; 新增一个共享的 `createSvelteBunPlugin` 作为 Bun bundler adapter, 通过 `onLoad` 处理 `.svelte` 和 `.svelte.ts/.svelte.js`。生产路径和 dev 编译路径都使用 `Bun.build({ plugins })`; dev 的 Bun.serve 继续负责 HTTP、安全边界、静态资源与 watcher, `/main.ts` 通过系统临时 bootstrap 生成单一 bundle。Bun 官方的 `Bun.serve` plugin 能力由独立 `bunfig.toml` fixture 验证, CLI 不修改用户 bunfig。

**Tech Stack:** Bun 1.3.14, `Bun.build`, `Bun.plugin`, `Bun.serve`, Svelte 5, TypeScript, Bun test, Playwright smoke。

## Global Constraints

- 不新增 Vite、Rollup 或 Vite plugin 依赖。
- 不改变 `svelte-build`、`svelte-dev`、`svelte-lib/build` 和 `svelte-lib/route` 的现有公开接口。
- 不修改 `src/route`; 本计划只处理 `src/builder` 的编译和 dev pipeline。
- Bun plugin 只负责模块 resolve/load/compile; HTTP、静态资源安全边界和配置加载仍由 builder 负责。
- 不在 plugin 中使用字符串拼接改写任意 JavaScript import; 优先交给 Bun resolver。
- 每个任务完成后执行该任务的 focused test, 再进入下一个任务。

---

### Task 1: 验证 Bun plugin 与 fullstack dev 能力

**Files:**
- Create: `src/builder/tests/svelte-plugin.test.ts`
- Create: `tests/fixtures/builder-plugin-app/App.svelte`
- Create: `tests/fixtures/builder-plugin-app/main.ts`
- Create: `tests/fixtures/builder-plugin-app/state.svelte.ts`
- Create: `tests/fixtures/builder-plugin-app/state.svelte.js`
- Create: `tests/fixtures/builder-plugin-app/index.html`
- Create: `tests/fixtures/builder-plugin-app/bunfig.toml`
- Create: `tests/fixtures/builder-plugin-app/fullstack-server.ts`
- Create: `tests/fixtures/builder-plugin-app/svelte-dev-plugin.ts`
- Create: `tests/fixtures/builder-plugin-app/svelte-runtime-plugin.ts`

**Interfaces:**
- Consumes: current `createSvelteBunPlugin`, `Bun.build`, `Bun.plugin`, `Bun.serve`。
- Produces: a verified decision about whether the dev path can use Bun fullstack bundling with the custom Svelte plugin。

- [x] **Step 1: Add a production plugin fixture test**

  The fixture must import a `.svelte` component and a `.svelte.ts` rune module. Build it with `Bun.build({ plugins: [...] })`, `write: false`, and assert that the result is successful, contains JavaScript output, and contains the compiled component marker rather than raw Svelte markup.

- [x] **Step 2: Run the focused test and record the current failure boundary**

  Run: `bun test --conditions=browser src/builder/tests/svelte-plugin.test.ts`

  Expected before the shared adapter exists: the existing production plugin test may pass, while the new dev capability case identifies whether `Bun.plugin` is applied to a `Bun.serve` HTML route.

- [x] **Step 3: Add a Bun fullstack dev smoke fixture**

  Start a temporary `Bun.serve` instance with `development: { hmr: true }`, register the Svelte plugin through Bun's plugin API, request `/`, and assert that the response contains the generated JavaScript/CSS routes and no `Not Found` response for the Svelte entry.

- [x] **Step 4: Make the migration gate explicit**

  Continue with native Bun fullstack dev only if all of these pass: `.svelte` load, `.svelte.ts` load, CSS output, package import resolution, and browser HMR connection. If programmatic plugin registration is not honored by `Bun.serve`, keep the current HTTP server temporarily and use the shared transform core as the dev adapter; do not pretend that a Bun plugin can run outside a bundler.

- [ ] **Step 5: Commit the capability evidence**

  Commit only the fixture and test changes with message `test(builder): verify Bun plugin dev capabilities`.

### Task 2: Extract the shared Svelte Bun plugin

**Files:**
- Create: `src/builder/svelte-plugin.ts`
- Modify: `src/builder/build-internals.ts:506-533`
- Modify: `src/builder/build.ts:84-102`
- Modify: `src/builder/dev.ts:11-25,141-230`
- Test: `src/builder/tests/svelte-plugin.test.ts`

**Interfaces:**
- Consumes: existing Svelte compile options, CSS collection behavior, Svelte runtime alias plugin, and Bun `BunPlugin` types。
- Produces: `createSvelteBunPlugin(options): BunPlugin` with `mode: "build" | "dev"`, optional `cssByPath`, and optional compile logging callback。

- [x] **Step 1: Define the adapter contract in the focused test**

  The test must cover these inputs and outputs:

  ```ts
  type SvelteBunPluginOptions = {
      mode: "build" | "dev";
      cssByPath?: Map<string, string>;
      onCompile?: (path: string, contents: string) => void;
  };

  export const createSvelteBunPlugin = (options: SvelteBunPluginOptions): BunPlugin => ({
      name: "svelte-bun-plugin",
      setup(build) {
          // register .svelte and .svelte.ts/.svelte.js loaders
      },
  });
  ```

- [x] **Step 2: Move the `.svelte` and rune-module `onLoad` handlers**

  `.svelte` must call `compile` with `filename` and `generate: "client"`; build mode collects external CSS in `cssByPath`, while dev mode returns a browser-side CSS injection module. `.svelte.ts` and `.svelte.js` must use the existing `Bun.Transpiler` preparation followed by `compileModule`.

- [x] **Step 3: Keep resolution plugins separate from compilation**

  Keep `createSvelteRuntimeAliasPlugin` and `createProductionEsmEnvPlugin` as independent Bun plugins. The new Svelte compiler plugin must not absorb path security, runtime alias policy, or production diagnostic stripping.

- [x] **Step 4: Run the focused plugin tests**

  Run: `bun test --conditions=browser src/builder/tests/svelte-plugin.test.ts src/builder/tests/build-plugins.test.ts src/builder/tests/compiler-import.test.ts`

  Expected: all plugin cases pass and no test imports `compile` or `compileModule` directly from `src/builder/build.ts` or `src/builder/dev.ts`.

- [ ] **Step 5: Commit the shared adapter**

  Commit with message `refactor(builder): centralize Svelte Bun plugin`.

### Task 3: Migrate production `Bun.build`

**Files:**
- Modify: `src/builder/build.ts:84-102,383-404`
- Modify: `src/builder/build-internals.ts:506-533`
- Test: `src/builder/tests/build-lazy-chunks.test.ts`
- Test: `src/builder/tests/strip-svelte-diagnostics.test.ts`
- Test: `src/builder/tests/export-surface.test.ts`

**Interfaces:**
- Consumes: `createSvelteBunPlugin` from Task 2。
- Produces: production build behavior identical to the current public contract, with no direct Svelte compiler call in `build.ts`.

- [x] **Step 1: Replace the local compile callback with the plugin factory**

  The `Bun.build` plugin list must use `createSvelteBunPlugin({ mode: "build", cssByPath })` together with the existing alias and environment plugins. Keep output naming, splitting, sourcemap, asset copy, and HTML generation unchanged in this task.

- [x] **Step 2: Preserve CSS and lazy chunk assertions**

  Run: `bun test --conditions=browser src/builder/tests/build-lazy-chunks.test.ts src/builder/tests/strip-svelte-diagnostics.test.ts`

  Expected: hashed CSS, lazy chunks, stale output cleanup, diagnostics stripping, and custom mount id behavior remain unchanged.

- [x] **Step 3: Remove the obsolete production compiler helper**

  Delete only the now-unused `compileSvelteModule` path and its imports. Do not remove shared path validation or alias helpers.

- [ ] **Step 4: Commit the production migration**

  Commit with message `refactor(builder): use shared Svelte Bun plugin in build`.

### Task 4: Migrate dev compilation to Bun plugin bundling and HMR

**Files:**
- Modify: `src/builder/dev.ts`
- Modify: `src/builder/config.ts` only if dev entry configuration needs an internal derived path
- Modify: `src/builder/build-internals.ts` only for shared plugin imports
- Test: `src/builder/tests/cli-entry.test.ts`
- Test: `src/builder/tests/dev-reload.test.ts`
- Test: `src/builder/tests/dev-watch-events.test.ts`
- Add: browser smoke fixture under `src/builder/tests/fixtures/`
- Add: `tests/fixtures/builder-dev-app/`

**Interfaces:**
- Consumes: Task 1 capability result and Task 2 `createSvelteBunPlugin({ mode: "dev" })`。
- Produces: `serve()` that keeps the existing `DevServerHandle` and public CLI behavior while using Bun's bundler for Svelte modules.

- [x] **Step 1: Create the generated Bun bundle entry path**

  Use the existing generated bootstrap and HTML shell semantics, generate a temporary entry outside the consumer project, and expose the resulting single bundle at `/main.ts`. Preserve `mountId`, `appTitle`, configured assets, and the current source-root restrictions.

- [x] **Step 2: Use the shared plugin in dev Bun.build calls**

  Use `createSvelteBunPlugin({ mode: "dev" })` for the generated app bundle and direct source module requests. Keep Bun.serve as the HTTP/reload boundary; do not mutate a consumer's `bunfig.toml`, add Vite, or introduce a Vite-compatible shim.

- [x] **Step 3: Preserve security and static asset behavior**

  Keep root containment, symlink checks, configured asset directories, node module restrictions, method handling, and error redaction. Only the Svelte/TS module compilation path may change.

- [x] **Step 4: Verify browser behavior before deleting the old path**

  Run the browser smoke fixture against a temporary app and verify: initial render, `.svelte` edit, `.svelte.ts` edit, CSS update, package import, browser console, and HMR reconnect after a compile error.

- [x] **Step 5: Remove the obsolete dev compiler path after parity**

  Remove direct `compile`, `compileModule`, `createCssInjection`, and per-module string import rewriting after the smoke test passes. Retain the existing SSE reload hub until Bun fullstack HMR is made programmatically configurable; the current CLI must not mutate a consumer's `bunfig.toml`.

- [ ] **Step 6: Commit the dev migration**

  Commit with message `refactor(builder): use Bun fullstack dev pipeline`.

### Task 5: Update docs and package contracts

**Files:**
- Modify: `src/builder/README.md`
- Modify: `src/builder/tests/export-surface.test.ts`
- Modify: `tests/package-exports.test.ts` only if the implementation moves an entry file
- Modify: `package.json` only to keep the existing Bun-first exports accurate

**Interfaces:**
- Consumes: final build/dev behavior from Tasks 3 and 4。
- Produces: documentation that describes Bun plugin/fullstack behavior without implying Vite support。

- [x] **Step 1: Document the ownership boundary**

  State that Bun plugin handles Svelte module compilation, Bun serves the development graph/HMR, and builder retains config/assets/security policy. Document the exact Bun version floor used by the implementation.

- [x] **Step 2: Remove obsolete dev implementation claims**

  Delete documentation that describes the old manual module server, SSE-only reload contract, or string-based import rewriting when those paths no longer exist.

- [x] **Step 3: Run package policy tests**

  Run: `bun test --conditions=browser tests/package-exports.test.ts tests/package-policy.test.ts src/builder/tests/export-surface.test.ts`

  Result: 6 pass, 0 fail; public exports remain unchanged and no Vite dependency appears in package metadata.

### Task 6: Full verification and handoff

**Files:**
- Test: all existing builder tests
- Test: browser smoke fixture
- Check: `git diff --check`

**Interfaces:**
- Consumes: completed Tasks 1-5。
- Produces: evidence-backed completion status and residual-risk list。

- [x] **Step 1: Run typecheck**

  Run: `bun run typecheck`

  Result: `svelte-check found 0 errors and 0 warnings`.

- [x] **Step 2: Run the full test suite**

  Run: `bun run test`

  Result: 157 pass, 0 fail, 485 expect() calls across 36 files.

- [x] **Step 3: Run production and dev integration checks**

  Run the existing build fixture suite and the browser smoke flow against a real temporary consumer project. Record whether HMR is state-preserving or falls back to a full reload.

  Result: Bun plugin/fullstack fixture, production build fixtures, dev entry requests, CSS injection, `.svelte.ts`/`.svelte.js` compilation, and browser reload flow were verified; dev intentionally retains full-page SSE reload rather than claiming state-preserving HMR.

- [x] **Step 4: Check the worktree**

  Run: `git diff --check && git status --short`

  Result: no whitespace errors; intended source, test, fixture, documentation, and plan changes remain uncommitted. Existing `.tmp/` is retained.

- [x] **Step 5: Report residual risk**

  Explicitly report Bun version sensitivity, plugin registration behavior, HMR limitations, and any remaining custom server code. Do not claim Vite-level module graph parity unless the browser smoke evidence demonstrates it.
