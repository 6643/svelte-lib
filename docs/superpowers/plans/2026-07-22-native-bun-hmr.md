# Native Bun HMR Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不修改 consumer `bunfig.toml` 的前提下验证 Bun 官方 fullstack HMR, 并仅在真实浏览器 capability gate 通过时接入生成的 native dev workspace。

**Architecture:** Builder 在系统临时目录生成独立 frontend workspace, 其中的 `bunfig.toml` 注册共享 Svelte plugin, `index.html`/`main.ts` 提供 app entry, 子进程以 `--config=<临时 bunfig.toml>` 和 consumer root cwd 启动 `Bun.serve` 负责官方 fullstack HMR。native child 启动失败时回退现有 custom `Bun.serve` + SSE server。

**Tech Stack:** Bun 1.3.14, `Bun.serve`, `Bun.build`, `Bun.spawn`, `bunfig.toml`, Svelte 5, Bun test, Playwright CLI。

## Global Constraints

- 不引入 Vite、Rollup 或其它 bundler。
- 不写入或修改 consumer 项目的 `bunfig.toml`。
- 不暴露 app source root、node_modules 或 assets root 之外的文件。
- 不把 Bun HMR transport 可用写成 Svelte state-preserving HMR 已成功。
- native server capability 不完整时必须保留现有 SSE full-page reload fallback。
- 不修改 `src/route` 的 runtime API。
- 所有异步 child/watcher 生命周期必须可等待, 不产生未处理 Promise rejection。

---

### Task 1: Define the generated workspace contract

**Files:**
- Create: `src/builder/native-dev.ts`
- Test: `src/builder/tests/native-dev.test.ts`

**Interfaces:**
- Consumes: validated app component path, mount id, app title, source root and resolved assets from `dev.ts`.
- Produces:

```ts
export type NativeDevWorkspaceOptions = {
    rootDir: string;
    sourceRoot: string;
    appComponentPath: string;
    appTitle: string;
    mountId: string;
    packageRoot: string;
    assets: Array<{ dirName: string; physicalPath: string }>;
};

export type NativeDevWorkspace = {
    rootDir: string;
    serverPath: string;
    cleanup: () => Promise<void>;
};

export const createNativeDevWorkspace = (
    options: NativeDevWorkspaceOptions,
): Promise<Result<NativeDevWorkspace>>;
```

- [x] **Step 1: Write the failing manifest test**

  Create a temporary workspace from a fixture app and assert that `bunfig.toml`, `index.html`, `main.ts`, and `server.ts` exist; assert that generated source contains the absolute, validated app path and the two plugin module paths, while the consumer root contains no new file.

- [x] **Step 2: Run the test to verify it fails**

  Run: `bun test --conditions=browser src/builder/tests/native-dev.test.ts`

  Expected: FAIL because `createNativeDevWorkspace` does not exist.

- [x] **Step 3: Implement the smallest workspace writer**

  Use `mkdtemp(join(tmpdir(), "svelte-lib-native-dev-"))`. Write only generated files under that directory. Escape every injected path with `JSON.stringify`; generate a `bunfig.toml` whose plugin entries are relative to the workspace and point at generated shims importing `createSvelteRuntimeAliasPlugin` and `createSvelteBunPlugin({ mode: "dev" })` from `packageRoot`.

  The runtime alias shim must call `createSvelteRuntimeAliasPlugin(rootDir)` so the generated server resolves the consumer's installed Svelte peer; `packageRoot` is used only to import builder implementation modules. Create `workspaceRoot/app` as a directory symlink to `sourceRoot`, and make `main.ts` import the component through that symlink so Bun watches the source graph.

- [x] **Step 4: Run the manifest test**

  Run the focused command again. Expected: PASS and cleanup removes only the generated workspace.

### Task 2: Start and stop the official Bun fullstack server

**Files:**
- Modify: `src/builder/native-dev.ts`
- Test: `src/builder/tests/native-dev.test.ts`

**Interfaces:**
- Consumes: `NativeDevWorkspace`.
- Produces:

```ts
export type NativeDevServerHandle = {
    exited: Promise<number>;
    port: number;
    stop: () => Promise<void>;
};

export const startNativeDevServer = (
    workspace: NativeDevWorkspace,
    port: number,
): Promise<Result<NativeDevServerHandle>>;
```

- [x] **Step 1: Write the failing lifecycle test**

  Start the generated server with an ephemeral port, fetch `/`, assert status 200 and a generated script route, then call `stop()` and assert the process exits and the generated workspace is removable.

- [x] **Step 2: Run the lifecycle test to verify it fails**

  Run: `bun test --conditions=browser src/builder/tests/native-dev.test.ts --test-name-pattern 'native server lifecycle'`

  Expected: FAIL because `startNativeDevServer` does not exist.

- [x] **Step 3: Implement child startup and ready parsing**

  Spawn `[process.execPath, workspace.serverPath]` with `cwd: workspace.rootDir`, pipe stdout/stderr, pass the requested port, and wait for one JSON ready line within a bounded timeout. On timeout, non-zero exit, or malformed ready output, kill the child and return `err(...)`. `stop()` must be idempotent, kill the child, await `child.exited`, then call workspace cleanup.

- [x] **Step 4: Run the lifecycle test**

  Run the focused command. Expected: PASS with no leaked child process.

### Task 3: Add native policy routes and capability fixture

**Files:**
- Modify: `src/builder/native-dev.ts`
- Modify: `src/builder/tests/native-dev.test.ts`
- Create: `tests/fixtures/builder-native-hmr/App.svelte`
- Create: `tests/fixtures/builder-native-hmr/state.svelte.ts`

**Interfaces:**
- Consumes: generated native server and `resolvePhysicalAssetPath` policy.
- Produces: native `/` route, configured asset route, generic error route, and a browser-visible HMR probe module.

- [x] **Step 1: Write failing policy assertions**

  Assert that the generated server returns configured assets, rejects traversal and unknown paths with 404, returns a generic 500 for a compiler failure, and does not expose `builder.ts` or arbitrary files.

- [x] **Step 2: Run the policy test to verify the missing route behavior**

  Run: `bun test --conditions=browser src/builder/tests/native-dev.test.ts --test-name-pattern 'native policy'`

  Expected: FAIL on the missing generated policy handlers.

- [x] **Step 3: Implement guarded generated fetch logic**

  Generate only the validated asset directory metadata and app source prefix. For assets resolve through the existing physical-root helper; for all other non-HMR paths return 404 or the generic error response. Do not add a general-purpose proxy or raw filesystem route.

- [x] **Step 4: Run the policy test**

  Run the focused command. Expected: PASS.

### Task 4: Run the real browser capability gate

**Files:**
- Modify: `src/builder/tests/native-dev.test.ts`
- Modify: `src/builder/README.md`
- Modify: `docs/superpowers/specs/2026-07-22-native-bun-hmr-design.md`

**Interfaces:**
- Consumes: native server handle and fixture app.
- Produces: an evidence-backed native HMR decision; no default-path switch without all assertions.

- [x] **Step 1: Write the failing browser test**

  Start the native server, use Playwright to load `/`, record `location.reload` calls and console errors, edit the fixture module, and assert the DOM changes without a reload. Restore the fixture in `finally`.

- [x] **Step 2: Run the browser test to observe the actual Bun/Svelte boundary**

  Run: `bun test --conditions=browser src/builder/tests/native-dev.test.ts --test-name-pattern 'browser HMR capability'`

  Expected: the test either passes all state-preserving assertions or fails with a precise capability gap, not a swallowed error.

- [x] **Step 3: Implement only the smallest adapter required by the observed gap**

  If Bun replaces the module but the app entry does not accept it, add an explicit `import.meta.hot.accept` path to the generated bootstrap and test it again. Do not copy Bun private runtime code or claim state preservation if the callback cannot update observable state.

- [x] **Step 4: Record the gate result**

  If all assertions pass, switch `serve()` to native mode only after preserving source/assets/error policy and keep SSE as startup fallback. If any HMR assertion fails, leave `serve()` on SSE fallback and document the exact unsupported boundary.

### Task 5: Full verification and handoff

**Files:**
- Modify: `src/builder/README.md` if the gate result changes the documented mode.
- Modify: `docs/superpowers/plans/2026-07-22-native-bun-hmr.md`

- [x] **Step 1: Run focused builder tests**

  Run: `bun test --conditions=browser src/builder/tests/native-dev.test.ts src/builder/tests/cli-entry.test.ts src/builder/tests/svelte-plugin.test.ts src/builder/tests/dev-reload.test.ts`.

- [x] **Step 2: Run repository verification**

  Run: `bun run typecheck && bun run test && git diff --check`.

- [x] **Step 3: Run demo consumer smoke**

  Run `bun run build` in `demo/`, start the selected dev server, and verify `/`, the entry asset, one Svelte module, and the configured asset URL.

- [x] **Step 4: Record status**

Verification result for the initial native integration: `bun run typecheck` reports 0 errors and 0 warnings; `bun run test` reports 161 pass, 0 fail, 519 expect() calls; `git diff --check` passes. Demo `bun run build` succeeds. Native dev smoke returns 200 for `/`, `/main.ts`, and `/src/Counter.svelte`, configured asset contents for `/assets/hello.txt`, 404 for `/builder.ts`, and 204 for `/favicon.ico`. The initial browser gate verified module HMR, CSS update, compile-error recovery, and stable boot count on Bun `1.3.14`.

Follow-up hardening completed: native parent watcher now rebuilds the workspace and child when config or resolved asset roots change, keeps the actual port stable, serializes restart tasks, and attempts rollback after a failed replacement. Generated bootstrap accepts root component updates and remounts the component, so the browser gate now observes module HMR with 0 document reloads, CSS update with 0 document reloads and one component remount, plus 0 console errors. The repeatable command is `bun run test:browser:native-hmr`. Bun's official development error overlay may show compiler diagnostics, so native dev remains local-only; startup failure still falls back to SSE.

  Record exact test counts, whether native HMR was integrated or rejected by the gate, remaining Bun version sensitivity, and the uncommitted worktree status. Do not commit or stage automatically.

### Task 6: Supervise natural native child exits

**Files:**
- Modify: `src/builder/native-dev.ts`
- Modify: `src/builder/dev.ts`
- Modify: `src/builder/tests/native-dev.test.ts`
- Modify: `src/builder/README.md`
- Modify: `docs/superpowers/specs/2026-07-22-native-bun-hmr-design.md`

- [x] **Step 1: Expose and verify the child exit contract**

  `NativeDevServerHandle.exited` now exposes Bun's `Subprocess.exited`; `stop()` checks `exitCode` before killing an already naturally exited child. The focused natural-exit test verifies exit code `17` and workspace cleanup.

- [x] **Step 2: Add a measurable expected/unexpected exit supervisor**

  `createNativeDevServerExitSupervisor` observes each active handle and uses a `WeakSet` to suppress expected exits from `stop()` and configuration replacement. Its contract test reports unexpected exit code `17` and ignores expected exit code `0`.

- [x] **Step 3: Connect serialized restart and failure bounds**

  Native runtime exits force the existing serialized restart queue to rebuild the temporary workspace on the same actual port. Stable children reset the consecutive automatic-restart count after 1 second; three consecutive automatic restarts are the cap. Configuration changes reset the count after a successful replacement, and user stop remains terminal.

- [x] **Step 4: Verify the follow-up stage**

  Focused native lifecycle tests and the existing native configuration/asset restart test pass; final `bun run test` reports 165 pass, 0 fail and 540 expect calls, `bun run typecheck` reports 0 errors and 0 warnings, demo `bun run build` succeeds, `bun run test:browser:native-hmr` reports CSS/module HMR with 0 reloads, and `git diff --check` passes.
