# Builder Assets Dirs Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `assetsDirs: string[]` as the only static-assets config in `svelte-lib/builder`, expose each static directory at its own URL prefix, and update docs so `builder.ts` clearly remains the single configuration entrypoint with explicit default values.

**Architecture:** Replace the current single-assets-root model with a normalized multi-directory model. `assets.ts` will own directory normalization and per-directory path validation, while `build.ts` and `dev.ts` will consume the normalized directory list to copy or serve each directory by its own directory name. The old `assetsDir` path will be removed entirely, and documentation will be updated to make `builder.ts` the only documented configuration surface with all default values spelled out.

**Tech Stack:** Bun, TypeScript, Svelte 5, Bun test, svelte-check

---

### Task 1: Lock The New Config Surface With Failing Tests

**Files:**
- Modify: `src/builder/tests/assets.test.ts`
- Modify if needed: `src/builder/tests/load-config.test.ts`

- [ ] **Step 1: Add failing tests for `assetsDirs` normalization**

Extend `src/builder/tests/assets.test.ts` to cover:

- `assetsDirs: ["assets", "public"]` resolves both directories
- duplicate directory names are rejected
- missing explicitly configured directory in `assetsDirs` is rejected
- `assetsDir` is rejected as an unsupported field

Add a config-level test in `src/builder/tests/load-config.test.ts` that:

- accepts `assetsDirs: ["assets", "public"]`
- rejects configs that define `assetsDir`

- [ ] **Step 2: Run targeted tests and verify they fail**

Run:

```bash
bun test src/builder/tests/assets.test.ts src/builder/tests/load-config.test.ts
```

Expected:

- FAIL because `assetsDirs` is not implemented yet

- [ ] **Step 3: Commit the red tests**

```bash
git add src/builder/tests/assets.test.ts src/builder/tests/load-config.test.ts
git commit -m "test: lock builder assetsDirs config"
```

### Task 2: Implement Assets Directory Normalization In `assets.ts`

**Files:**
- Modify: `src/builder/assets.ts`
- Test: `src/builder/tests/assets.test.ts`

- [ ] **Step 1: Introduce a normalized assets-dir shape**

Add a small type such as:

```ts
export type ResolvedAssetsDir = {
    dirName: string;
    physicalPath: string;
};
```

Add a new entrypoint:

```ts
export const resolveConfiguredAssetsDirs = async (
    rootDir: string,
    assetsDirs?: string[],
    defaultAssetsDir = "assets",
): Promise<Result<ResolvedAssetsDir[]>>
```

Rules:

- `assetsDirs` only:
  - validate each directory
- no explicit config:
  - default to `["assets"]` if it exists
  - allow missing default directory as “no static dirs”

- [ ] **Step 2: Validate directory names and duplicates**

For each configured entry:

- resolve to a physical path inside the project root
- require a directory
- derive `dirName` from the final path basename
- reject duplicate `dirName`

Do not yet change build/dev behavior in this task.

- [ ] **Step 3: Keep per-directory helpers reusable**

Reuse or adapt the current single-directory helpers:

- `resolveAssetPath`
- `resolvePhysicalAssetPath`
- `copyConfiguredAssets`

so they still operate on one validated directory at a time.

- [ ] **Step 4: Re-run the targeted tests**

Run:

```bash
bun test src/builder/tests/assets.test.ts src/builder/tests/load-config.test.ts
```

Expected:

- PASS for config and normalization behavior

- [ ] **Step 5: Commit**

```bash
git add src/builder/assets.ts src/builder/tests/assets.test.ts src/builder/tests/load-config.test.ts
git commit -m "feat: normalize builder assetsDirs config"
```

### Task 3: Teach `build.ts` To Copy Multiple Static Directories

**Files:**
- Modify: `src/builder/build.ts`
- Modify if needed: `src/builder/tests/assets.test.ts`

- [ ] **Step 1: Extend config parsing to accept `assetsDirs`**

Update `SUPPORTED_CONFIG_FIELDS` and config parsing so:

- `assetsDirs?: string[]` is accepted
- `assetsDir` is rejected as an unknown/unsupported field

Keep this as the only config-surface change in this task.

- [ ] **Step 2: Replace single-directory build logic with a loop**

Current build flow assumes one directory. Change it to:

- call `resolveConfiguredAssetsDirs(...)`
- for each resolved directory:
  - copy contents to `<outDir>/<dirName>/`

Do not rename or flatten any paths.

- [ ] **Step 3: Add or extend a build-level regression test if needed**

If current tests do not cover output layout, add the smallest build-level check that verifies:

- `assetsDirs: ["assets", "public"]`
- output contains both:
  - `<outDir>/assets/...`
  - `<outDir>/public/...`

- [ ] **Step 4: Run the relevant builder tests**

Run:

```bash
bun test src/builder/tests/assets.test.ts src/builder/tests/load-config.test.ts
```

Expected:

- PASS

- [ ] **Step 5: Commit**

```bash
git add src/builder/build.ts src/builder/tests/assets.test.ts src/builder/tests/load-config.test.ts
git commit -m "feat: copy multiple builder asset directories"
```

### Task 4: Teach `dev.ts` To Serve Multiple Static Directories

**Files:**
- Modify: `src/builder/dev.ts`
- Add or modify: `src/builder/tests/dev-assets.test.ts` if needed

- [ ] **Step 1: Replace the hard-coded `/assets/` assumption**

Refactor the dev static-file branch so it:

- inspects the first URL path segment
- matches it against the normalized `assetsDirs` set
- serves files from the matching physical directory

Example:

- `/assets/logo.svg` → `assets/`
- `/public/banner.png` → `public/`

- [ ] **Step 2: Update watch roots**

Make `resolveDevWatchRoots(...)` include every resolved assets directory rather than a single optional one.

- [ ] **Step 3: Add a focused dev regression test**

Cover at least:

- `/assets/*` resolves against `assets`
- `/public/*` resolves against `public`
- unknown prefixes still 404

- [ ] **Step 4: Run focused dev tests**

Run:

```bash
bun test src/builder/tests/dev-watch-events.test.ts src/builder/tests/assets.test.ts
```

Expected:

- PASS

- [ ] **Step 5: Commit**

```bash
git add src/builder/dev.ts src/builder/tests/assets.test.ts src/builder/tests/dev-watch-events.test.ts
git commit -m "feat: serve multiple builder asset directories in dev"
```

### Task 5: Update Builder Documentation And Migration Notes

**Files:**
- Modify: `src/builder/README.md`
- Modify if needed: `docs/migrations/2026-04-latest-svelte5-migration.md`
- Modify if needed: `tests/bun-latest-api.test.ts`

- [ ] **Step 1: Rewrite the static assets section**

Document:

- preferred config:

```ts
export default {
    assetsDirs: ["assets", "public"],
};
```

- directory-name-to-URL-prefix behavior
- `builder.ts` is the only supported config file
- the default values table, including `assetsDirs`

- [ ] **Step 2: Document the breaking change**

Make it explicit that:

- `assetsDir` has been removed
- `assetsDirs` is now the only static-assets config entry
- omitting `assetsDirs` means “try `assets/`, otherwise no static dirs”

- [ ] **Step 3: Add doc-policy assertions if needed**

If repository policy tests already pin builder docs, add the minimal assertions needed so this new config does not drift.

- [ ] **Step 4: Run doc-focused tests**

Run:

```bash
bun test tests/bun-latest-api.test.ts
```

Expected:

- PASS

- [ ] **Step 5: Commit**

```bash
git add src/builder/README.md docs/migrations/2026-04-latest-svelte5-migration.md tests/bun-latest-api.test.ts
git commit -m "docs: describe builder assetsDirs"
```

### Task 6: Final Verification

**Files:**
- Verify only: `src/builder/assets.ts`
- Verify only: `src/builder/build.ts`
- Verify only: `src/builder/dev.ts`
- Verify only: `src/builder/tests/*`

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

- [ ] **Step 3: Inspect config/documentation surface**

Run:

```bash
rg -n "assetsDir|assetsDirs" src/builder README.md docs/migrations/2026-04-latest-svelte5-migration.md
```

Expected:

- `assetsDirs` appears as the primary documented config
- `assetsDir` no longer appears as a live supported config

- [ ] **Step 4: Create the final integration commit**

```bash
git add src/builder tests README.md docs/migrations/2026-04-latest-svelte5-migration.md
git commit -m "feat: support multiple builder asset directories"
```

## 回滚

如果多目录支持带来不可接受复杂度：

1. 恢复单个 `assetsDir` 配置
2. 删除 `assetsDirs`
3. 回退 `assets.ts` / `build.ts` / `dev.ts`
4. 回退 README 与测试到单根静态资源语义
