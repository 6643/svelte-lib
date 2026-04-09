# Builder Config Extraction Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract the builder configuration types, parsing, and loading logic from `src/builder/build.ts` into a dedicated `src/builder/build-config.ts` module without changing any public behavior.

**Architecture:** Keep `build.ts` as the high-level orchestration layer, but move config-oriented concerns into a focused module. `build-config.ts` will own `BuildSvelteOptions`, `BuildCliDependencies`, config field readers, `defineSvelteConfig`, `loadSvelteConfig`, and related parsing helpers. `build.ts` will import from it and continue re-exporting the public surface through `src/builder/_.ts`.

**Tech Stack:** Bun, TypeScript, Svelte 5, Bun test, svelte-check

---

### Task 1: Lock The Current Public Config Surface

**Files:**
- Modify if needed: `tests/package-exports.test.ts`
- Modify if needed: `src/builder/tests/load-config.test.ts`

- [ ] **Step 1: Confirm `load-config` tests fully cover the config loader contract**

Review the existing `src/builder/tests/load-config.test.ts` cases and ensure they still explicitly cover:

- default-exported `builder.ts`
- legacy JSON rejection
- side-effect isolation
- noisy stdout tolerance
- `mountId`
- `assetsDirs`
- `assetsDir` rejection

Only add tests if a real contract gap exists.

- [ ] **Step 2: Run the focused tests on the baseline**

Run:

```bash
bun test src/builder/tests/load-config.test.ts tests/package-exports.test.ts
```

Expected:

- PASS

- [ ] **Step 3: Commit only if tests were changed**

```bash
git add src/builder/tests/load-config.test.ts tests/package-exports.test.ts
git commit -m "test: lock builder config loading surface"
```

### Task 2: Create `build-config.ts`

**Files:**
- Create: `src/builder/build-config.ts`
- Modify: `src/builder/build.ts`
- Modify if needed: `src/builder/_.ts`

- [ ] **Step 1: Move the public config types**

Copy from `src/builder/build.ts` into `src/builder/build-config.ts`:

- `BuildSvelteOptions`
- `BuildCliDependencies`

Do not change the type shapes.

- [ ] **Step 2: Move config constants and helpers**

Move into `build-config.ts`:

- `CONFIG_FILE_NAME`
- `LOAD_CONFIG_RUNNER_PATH`
- `SUPPORTED_CONFIG_FIELDS`
- `readOptionalStringField`
- `readOptionalAssetsDirsField`
- `readOptionalAppComponentField`
- `readOptionalNumberField`
- `readOptionalBooleanField`
- `validateMountId`
- `validateAppComponent`
- `parseBuildConfig`
- `loadModuleConfigFile`

Keep helper behavior byte-for-byte equivalent where possible.

- [ ] **Step 3: Move public config functions**

Move:

- `defineSvelteConfig`
- `loadSvelteConfig`

to `build-config.ts`.

- [ ] **Step 4: Rewire `build.ts` imports**

In `build.ts`:

- remove the moved definitions
- import the moved types/functions from `./build-config`
- keep `build.ts`’s remaining orchestration logic unchanged

Do not move:

- `Result`
- `HtmlShell`
- `BuildArtifacts`
- `buildSvelte`
- `runConfiguredBuild`
- `runBuildCli`

- [ ] **Step 5: Re-export the config types from `build.ts` if needed**

Because `src/builder/_.ts` currently re-exports types and functions from `./build`, ensure the public builder import surface remains unchanged.

Choose the smallest approach:

- either re-export `BuildSvelteOptions`, `BuildCliDependencies`, `defineSvelteConfig`, and `loadSvelteConfig` from `build.ts`
- or adjust `src/builder/_.ts` very carefully if that produces a cleaner boundary without changing public semantics

Preferred default: keep `src/builder/_.ts` unchanged by re-exporting from `build.ts`.

### Task 3: Focused Verification

**Files:**
- Verify only: `src/builder/build-config.ts`
- Verify only: `src/builder/build.ts`
- Verify only: `src/builder/_.ts`
- Verify only: `src/builder/tests/load-config.test.ts`

- [ ] **Step 1: Run the focused tests**

Run:

```bash
bun test src/builder/tests/load-config.test.ts tests/package-exports.test.ts
```

Expected:

- PASS

- [ ] **Step 2: Run typecheck**

Run:

```bash
bun run typecheck
```

Expected:

- `svelte-check found 0 errors and 0 warnings`

- [ ] **Step 3: Spot-check the builder public surface**

Run:

```bash
rg -n "defineSvelteConfig|loadSvelteConfig|BuildSvelteOptions|BuildCliDependencies" src/builder/build.ts src/builder/build-config.ts src/builder/_.ts
```

Expected:

- those symbols now live in `build-config.ts`
- `build.ts` still makes the public surface reachable

### Task 4: Final Integration Commit

**Files:**
- Add or modify everything touched in this plan

- [ ] **Step 1: Commit the extraction**

```bash
git add src/builder/build.ts src/builder/build-config.ts src/builder/_.ts src/builder/tests/load-config.test.ts tests/package-exports.test.ts
git commit -m "refactor: extract builder config loading"
```

## 回滚

若拆分引入行为变化或导出漂移：

1. 删除 `src/builder/build-config.ts`
2. 将配置类型、解析和加载逻辑移回 `src/builder/build.ts`
3. 恢复任何为这次拆分做的 re-export 调整
