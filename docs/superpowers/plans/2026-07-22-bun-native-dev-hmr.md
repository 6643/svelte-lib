# Bun Native Dev HMR Investigation Plan

> Superseded by `2026-07-22-native-bun-hmr.md`: the later stage verified the required watcher cwd/config boundary and integrated native Bun HMR with SSE startup fallback.

> **For agentic workers:** Execute this plan task-by-task with focused verification after each task. Do not replace the current dev fallback until the capability gate passes.

**Goal:** Determine whether Bun's official frontend dev server can own the Svelte module graph and HMR without Vite, then integrate it only if the existing security and configuration contract can be preserved.

**Architecture:** Keep `createSvelteBunPlugin` as the single Svelte compiler adapter. First verify Bun's supported frontend-dev path, where plugins are loaded through `bunfig.toml`; the existing custom `Bun.serve` path remains the fallback during the investigation. If native HMR is usable, run it in an isolated generated workspace and keep the builder as the policy boundary. If it is not usable through the public API, document that boundary and improve the current Bun.build plus SSE path instead of inventing an unsupported plugin hook.

**Tech Stack:** Bun 1.3.14 frontend dev server, `Bun.build`, `Bun.serve`, `bunfig.toml`, Svelte 5, Bun test, Playwright smoke.

## Global Constraints

- Do not add Vite, Rollup, or a Vite-compatible shim.
- Do not mutate a consumer project's `bunfig.toml`.
- Preserve source-root containment, node_modules package boundaries, static asset policy, and public CLI entry points.
- Do not claim state-preserving HMR unless a browser test observes module replacement without a full-page reload.
- Keep the current SSE full-page reload fallback until the native capability gate passes.

---

### Task 1: Verify Bun's supported frontend-dev plugin path

**Files:**
- Modify: `src/builder/tests/svelte-plugin.test.ts`
- Modify: `tests/fixtures/builder-plugin-app/fullstack-server.ts`
- Modify: `tests/fixtures/builder-plugin-app/bunfig.toml`

**Interfaces:**
- Consumes: `createSvelteBunPlugin`, Bun frontend dev server, existing fixture app.
- Produces: a reproducible capability result for plugin loading, CSS, package resolution, and HMR mode.

- [x] **Step 1: Add an explicit capability assertion**

  Extend the existing fullstack fixture result with the server's `development` state and an observable compiled-module marker. Keep the plugin registration in `bunfig.toml`, which is the documented frontend-dev integration point.

- [x] **Step 2: Run the focused capability test**

  Run: `bun test --conditions=browser src/builder/tests/svelte-plugin.test.ts`

  Expected: the fixture returns HTTP 200 for HTML and generated JavaScript, includes the compiled Svelte output and CSS injection, and starts with HMR enabled.

- [x] **Step 3: Test the unsupported programmatic shape**

  Inspect the `Bun.serve` type and runtime options used by the builder. Record that `development.hmr` exists but `Bun.serve` has no `plugins` option; do not add an untyped `plugins` cast to production code.

### Task 2: Define the native-server integration boundary

**Files:**
- Modify: `src/builder/README.md`
- Modify: `src/builder/tests/svelte-plugin.test.ts`
- Modify: `docs/superpowers/plans/2026-07-22-bun-svelte-plugin-pipeline.md`

**Interfaces:**
- Consumes: Task 1 capability result and Bun's documented plugin support boundary.
- Produces: an explicit decision: native frontend-dev integration or supported fallback.

- [x] **Step 1: Add the decision test/documentation**

  Assert that the builder's public dev path continues to use `Bun.build({ plugins })` for Svelte compilation and does not claim that `Bun.serve` accepts a plugin list. Document the exact Bun 1.3.14 boundary and the reason consumer `bunfig.toml` is not edited.

- [x] **Step 2: Run package and documentation policy tests**

  Run: `bun test --conditions=browser tests/package-policy.test.ts tests/package-exports.test.ts src/builder/tests/export-surface.test.ts`

  Expected: public exports remain unchanged and no Vite dependency or unsupported server plugin configuration appears.

### Task 3: Improve the supported fallback path

**Files:**
- Modify: `src/builder/dev.ts`
- Modify: `src/builder/tests/cli-entry.test.ts`
- Modify: `src/builder/tests/dev-reload.test.ts`

**Interfaces:**
- Consumes: the shared Svelte plugin and current `DevServerHandle`.
- Produces: stable Bun.build compilation plus explicit full-page reload behavior when native HMR is unavailable.

- [x] **Step 1: Add regression coverage for compile-error recovery**

  Exercise a temporary consumer app through `serve()`: fetch `/main.ts` successfully, write an invalid `.svelte` module, observe a failed module response without leaking compiler internals, restore the file, and verify that `/main.ts` compiles again after the watcher invalidates the cache.

- [x] **Step 2: Implement only the minimal cache/error correction**

  Keep `Bun.serve` as the HTTP boundary and `Bun.build` as the compiler boundary. Clear the dev bundle cache on source/config changes, return a generic 500 for compiler failures, and preserve the existing SSE reload event.

- [x] **Step 3: Run focused fallback tests**

  Run: `bun test --conditions=browser src/builder/tests/cli-entry.test.ts src/builder/tests/dev-reload.test.ts src/builder/tests/svelte-plugin.test.ts`

  Expected: initial bundle, `.svelte`/rune compilation, error recovery, and full-page reload behavior all pass.

### Task 4: Full verification and handoff

**Files:**
- Check: all builder tests, route tests, package policy tests, `git diff --check`
- Check: demo consumer build and dev endpoint smoke

- [x] **Step 1: Run typecheck and full tests**

  Run: `bun run typecheck` and `bun run test`.

  Result: `bun run typecheck` found 0 errors and 0 warnings; `bun run test` passed 158 tests with 0 failures.

- [x] **Step 2: Run the real consumer smoke**

  Result: `demo/` production build succeeded; dev smoke returned 200 for `/`, `/main.ts`, and `/src/App.svelte`, found `mount(App)` and CSS injection in the bundle, and returned the configured asset contents.

- [x] **Step 3: Record the final HMR decision**

  Result: native Bun fullstack HMR was verified only through the documented HTML-route plus `bunfig.toml` plugin path. The public `Bun.serve` options do not expose programmatic plugins, so the builder keeps its custom HTTP/security/watcher boundary and SSE full-page reload fallback; it does not claim state-preserving HMR. The verified baseline is Bun `1.3.14`.

- [x] **Step 4: Check the worktree**

  Run: `git diff --check && git status --short`.

  Result: `git diff --check` passed; only the intended implementation, tests, fixtures, documentation, plan files, and existing `.tmp/` remain uncommitted. No files were staged or committed.
