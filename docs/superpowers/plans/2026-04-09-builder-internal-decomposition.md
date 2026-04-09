# Builder Internal Decomposition Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `src/builder/build.ts` and `src/builder/dev.ts` into smaller internal modules without changing the public `svelte-lib/builder` API or the behavior of `svelte-build` / `svelte-dev`.

**Architecture:** Keep `build.ts` and `dev.ts` as orchestration and CLI entry modules, and extract configuration, validation, publishing, import rewriting, reload, and asset-serving logic into focused builder-internal files. Existing small utility modules stay where they are; the refactor is only about redistributing oversized responsibilities, not changing product surface.

**Tech Stack:** Bun, TypeScript, Svelte 5, Bun test, svelte-check

---

### Task 1: Lock Current Public Builder Surface Before Refactoring

**Files:**
- Modify if needed: `tests/package-exports.test.ts`
- Modify if needed: `src/builder/tests/cli-entry.test.ts`

- [ ] **Step 1: Add or tighten public-surface assertions**

Ensure tests explicitly lock:

- `buildSvelte`
- `runConfiguredBuild`
- `runConfiguredDevServer`
- `runBuildCli`
- `runDevCli`

as still coming from the current public builder entrypoints.

- [ ] **Step 2: Run the focused public-surface tests**

Run:

```bash
bun test tests/package-exports.test.ts src/builder/tests/cli-entry.test.ts
```

Expected:

- PASS on the current baseline

- [ ] **Step 3: Commit the test lock if changed**

```bash
git add tests/package-exports.test.ts src/builder/tests/cli-entry.test.ts
git commit -m "test: lock builder public surface before decomposition"
```

### Task 2: Extract `build-config.ts`

**Files:**
- Create: `src/builder/build-config.ts`
- Modify: `src/builder/build.ts`
- Test: `src/builder/tests/load-config.test.ts`

- [ ] **Step 1: Move build-config types and config parsing helpers**

Extract into `build-config.ts`:

- `BuildSvelteOptions`
- `BuildCliDependencies`
- `defineSvelteConfig`
- `loadSvelteConfig`
- config field readers and parsing helpers

Keep imports and exports minimal. `build.ts` should re-export the public types it still owns publicly.

- [ ] **Step 2: Update `build.ts` to consume the new module**

Leave behavior unchanged. Only change internal imports and exports.

- [ ] **Step 3: Run focused config tests**

Run:

```bash
bun test src/builder/tests/load-config.test.ts tests/package-exports.test.ts
```

Expected:

- PASS

- [ ] **Step 4: Commit**

```bash
git add src/builder/build.ts src/builder/build-config.ts src/builder/tests/load-config.test.ts tests/package-exports.test.ts
git commit -m "refactor: extract builder config loading"
```

### Task 3: Extract `build-validate.ts`

**Files:**
- Create: `src/builder/build-validate.ts`
- Modify: `src/builder/build.ts`
- Test: `src/builder/tests/load-config.test.ts`
- Test: `src/builder/tests/import-graph.test.ts`
- Test: `src/builder/tests/svelte-runtime-alias.test.ts`

- [ ] **Step 1: Move validation helpers**

Extract into `build-validate.ts`:

- `resolveAppSourceRoot`
- `validateResolvedAppComponentPath`
- `validateLocalSourceImportGraph`
- `validateSvelteBrowserImportAliases`

Move any private helper functions they need, but do not move bundling code.

- [ ] **Step 2: Rewire `build.ts` imports**

`build.ts` should keep the high-level `buildSvelte` flow and call into `build-validate.ts`.

- [ ] **Step 3: Run the focused validation tests**

Run:

```bash
bun test src/builder/tests/import-graph.test.ts src/builder/tests/svelte-runtime-alias.test.ts src/builder/tests/load-config.test.ts
```

Expected:

- PASS

- [ ] **Step 4: Commit**

```bash
git add src/builder/build.ts src/builder/build-validate.ts src/builder/tests/import-graph.test.ts src/builder/tests/svelte-runtime-alias.test.ts src/builder/tests/load-config.test.ts
git commit -m "refactor: extract builder validation pipeline"
```

### Task 4: Extract `build-publish.ts`

**Files:**
- Create: `src/builder/build-publish.ts`
- Modify: `src/builder/build.ts`
- Test: existing builder build-focused tests

- [ ] **Step 1: Move stage/temp/publish helpers**

Extract publish lifecycle helpers:

- stage dir creation
- temp out dir creation
- publish lock acquisition
- publish / rollback helpers

Keep file naming, lock semantics, and rollback behavior unchanged.

- [ ] **Step 2: Keep `buildSvelte` orchestration in `build.ts`**

`build.ts` should still own the readable top-level build flow.

- [ ] **Step 3: Run build-focused tests**

Run:

```bash
bun test src/builder/tests/build-lazy-chunks.test.ts src/builder/tests/finalize-js.test.ts src/builder/tests/finalize-css.test.ts src/builder/tests/report.test.ts
```

Expected:

- PASS

- [ ] **Step 4: Commit**

```bash
git add src/builder/build.ts src/builder/build-publish.ts src/builder/tests/build-lazy-chunks.test.ts src/builder/tests/finalize-js.test.ts src/builder/tests/finalize-css.test.ts src/builder/tests/report.test.ts
git commit -m "refactor: extract builder publish lifecycle"
```

### Task 5: Extract `dev-imports.ts`

**Files:**
- Create: `src/builder/dev-imports.ts`
- Modify: `src/builder/dev.ts`
- Test: `src/builder/tests/dev-import-resolution.test.ts`

- [ ] **Step 1: Move bare import resolution and rewrite helpers**

Extract:

- `resolveBareImportPathForDev`
- bare import rewrite helpers
- package-root resolution helpers

- [ ] **Step 2: Rewire `dev.ts`**

Keep `dev.ts` as the request/router orchestration layer.

- [ ] **Step 3: Run focused import tests**

Run:

```bash
bun test src/builder/tests/dev-import-resolution.test.ts
```

Expected:

- PASS

- [ ] **Step 4: Commit**

```bash
git add src/builder/dev.ts src/builder/dev-imports.ts src/builder/tests/dev-import-resolution.test.ts
git commit -m "refactor: extract builder dev import rewriting"
```

### Task 6: Extract `dev-reload.ts`

**Files:**
- Create: `src/builder/dev-reload.ts`
- Modify: `src/builder/dev.ts`
- Test: `src/builder/tests/dev-watch-events.test.ts`

- [ ] **Step 1: Move watch/reload/SSE helpers**

Extract:

- watcher classification helpers that logically belong to reload management
- reload hub creation
- SSE response helpers

Do not change polling/watcher policy behavior.

- [ ] **Step 2: Keep top-level HTTP dispatch in `dev.ts`**

`dev.ts` should still be where requests are routed, but not where watcher internals are all defined.

- [ ] **Step 3: Run focused reload tests**

Run:

```bash
bun test src/builder/tests/dev-watch-events.test.ts
```

Expected:

- PASS

- [ ] **Step 4: Commit**

```bash
git add src/builder/dev.ts src/builder/dev-reload.ts src/builder/tests/dev-watch-events.test.ts
git commit -m "refactor: extract builder dev reload pipeline"
```

### Task 7: Extract `dev-config.ts` And `dev-assets.ts`

**Files:**
- Create: `src/builder/dev-config.ts`
- Create: `src/builder/dev-assets.ts`
- Modify: `src/builder/dev.ts`
- Test: `src/builder/tests/dev-assets.test.ts`
- Test: `src/builder/tests/assets.test.ts`

- [ ] **Step 1: Move runtime-state derivation to `dev-config.ts`**

Extract:

- `deriveDevRuntimeState`
- `resolveDevWatchRoots`

- [ ] **Step 2: Move static asset URL mapping to `dev-assets.ts`**

Extract:

- static asset request resolution
- path-segment to physical directory mapping

- [ ] **Step 3: Re-run focused dev-assets tests**

Run:

```bash
bun test src/builder/tests/dev-assets.test.ts src/builder/tests/assets.test.ts
```

Expected:

- PASS

- [ ] **Step 4: Commit**

```bash
git add src/builder/dev.ts src/builder/dev-config.ts src/builder/dev-assets.ts src/builder/tests/dev-assets.test.ts src/builder/tests/assets.test.ts
git commit -m "refactor: split builder dev config and assets handling"
```

### Task 8: Final Verification

**Files:**
- Verify only: `src/builder/*`
- Verify only: `tests/*`

- [ ] **Step 1: Run the full repository test suite**

Run:

```bash
bun run test
```

Expected:

- PASS with zero failures

- [ ] **Step 2: Run the full type check**

Run:

```bash
bun run typecheck
```

Expected:

- `svelte-check found 0 errors and 0 warnings`

- [ ] **Step 3: Inspect the remaining file sizes**

Run:

```bash
wc -l src/builder/build.ts src/builder/dev.ts src/builder/*.ts
```

Expected:

- `build.ts` and `dev.ts` are materially smaller than before
- extracted modules carry the redistributed responsibilities

- [ ] **Step 4: Create the final integration commit**

```bash
git add src/builder tests
git commit -m "refactor: decompose builder internals"
```

## 回滚

若拆分引入循环依赖或测试漂移：

1. 回退新建的 builder 内部模块
2. 恢复 `build.ts` / `dev.ts` 的原始实现组织
3. 恢复被改动的测试 import 路径
