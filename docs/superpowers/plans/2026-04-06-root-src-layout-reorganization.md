# Root `src/` Layout Reorganization Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize the package so `ui`, `use`, `route`, and `builder` live under a top-level `src/` tree while keeping the public subpath imports and CLI names unchanged.

**Architecture:** Keep the repository as a single published package. Move the four capability areas into `src/` as physical source directories, then retarget `exports`, `bin`, tests, demo references, and documentation to the new paths. Preserve all public package contracts (`svelte-lib/ui`, `svelte-lib/use`, `svelte-lib/route`, `svelte-lib/builder`, `svelte-build`, `svelte-dev`) and treat this as an internal layout migration only.

**Tech Stack:** Bun, TypeScript, Svelte 5, root package `exports`, Bun test, `svelte-check`

---

## File Map

### Keep At Repository Root

- `README.md`
- `package.json`
- `_.ts`
- `tests/`
- `docs/`
- `demo/`
- `tsconfig.json`

### Move Into `src/`

- `ui/` -> `src/ui/`
- `use/` -> `src/use/`
- `route/` -> `src/route/`
- `builder/` -> `src/builder/`

### Files That Must Be Updated After The Move

- Modify: `package.json`
- Modify: `_.ts`
- Modify: `README.md`
- Modify: `docs/migrations/2026-04-latest-svelte5-migration.md`
- Modify: `tests/package-exports.test.ts`
- Modify: `tests/package-policy.test.ts`
- Modify: `tests/bun-latest-api.test.ts`
- Modify: `demo/README.md`
- Modify: `demo/package.json` only if any repo-internal direct path is still referenced
- Modify: every moved file whose relative imports currently assume the old directory depth

### New Target Layout

```text
src/
  ui/
  use/
  route/
  builder/
demo/
  src/
docs/
tests/
README.md
_.ts
package.json
```

## Task 1: Lock Public Contract Before Moving Files

**Files:**
- Modify: `tests/package-exports.test.ts`
- Modify: `tests/package-policy.test.ts`
- Modify: `tests/bun-latest-api.test.ts`

- [ ] **Step 1: Add/adjust failing tests for the new physical paths**

Update the repository-structure assertions so they expect:

```ts
expect(rootPackage.exports).toMatchObject({
  "./ui": "./src/ui/_.ts",
  "./use": "./src/use/_.ts",
  "./route": "./src/route/_.ts",
  "./builder": "./src/builder/_.ts",
});

expect(rootPackage.bin).toEqual({
  "svelte-build": "./src/builder/build.ts",
  "svelte-dev": "./src/builder/dev.ts",
});
```

Also update any hard-coded existence checks in `tests/bun-latest-api.test.ts` from `ui/...`, `use/...`, `route/...`, `builder/...` to `src/ui/...`, `src/use/...`, `src/route/...`, `src/builder/...`.

- [ ] **Step 2: Run tests to verify they fail for the current layout**

Run:

```bash
bun test tests/package-exports.test.ts tests/package-policy.test.ts tests/bun-latest-api.test.ts
```

Expected: FAIL on old root-level file paths and/or old `exports`/`bin` paths.

- [ ] **Step 3: Commit the red-state test changes only if working in an isolated implementation branch**

```bash
git add tests/package-exports.test.ts tests/package-policy.test.ts tests/bun-latest-api.test.ts
git commit -m "test: lock src layout package contract"
```

## Task 2: Retarget Root Package Entry Points

**Files:**
- Modify: `package.json`
- Modify: `_.ts`

- [ ] **Step 1: Update `package.json` `exports` and `bin`**

Set:

```json
"exports": {
  ".": "./_.ts",
  "./ui": "./src/ui/_.ts",
  "./use": "./src/use/_.ts",
  "./route": "./src/route/_.ts",
  "./builder": "./src/builder/_.ts",
  "./package.json": "./package.json"
},
"bin": {
  "svelte-build": "./src/builder/build.ts",
  "svelte-dev": "./src/builder/dev.ts"
}
```

- [ ] **Step 2: Update the root aggregator**

Retarget `_.ts` so any root re-exports that currently reach into `./ui`, `./use`, `./route`, `./builder` now reach into `./src/ui`, `./src/use`, `./src/route`, `./src/builder`.

- [ ] **Step 3: Run focused package contract tests**

Run:

```bash
bun test tests/package-exports.test.ts tests/package-policy.test.ts
```

Expected: PASS for `exports` and `bin` values, but other tests may still fail until files are moved.

## Task 3: Move `ui/` Into `src/ui/`

**Files:**
- Create: `src/ui/**`
- Delete: `ui/**`
- Modify: moved `src/ui/**` files whose relative imports need one extra `../`
- Modify: `tests/bun-latest-api.test.ts`
- Modify: `ui/tests/**` if those paths are also moved under `src/ui/tests/**`

- [ ] **Step 1: Move the full `ui/` tree into `src/ui/`**

This includes public components, helpers, and colocated tests/fixtures if they remain project-owned.

- [ ] **Step 2: Update broken relative imports**

Examples to fix:

```ts
// before
import { ensureSwiperBundleLoaded } from "./Swiper.bundle-loader.ts";

// after if file depth changes within moved tree and sibling relation stays same:
import { ensureSwiperBundleLoaded } from "./Swiper.bundle-loader.ts";
```

Sibling imports should stay the same. Only imports from outside `ui/` need path depth review.

- [ ] **Step 3: Update path assertions**

Change any checks such as:

```ts
expect(existsSync(resolve(repoRoot, "ui/Block.svelte"))).toBe(true);
```

to:

```ts
expect(existsSync(resolve(repoRoot, "src/ui/Block.svelte"))).toBe(true);
```

- [ ] **Step 4: Run focused UI tests**

Run:

```bash
bun test ui/tests
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/ui tests/bun-latest-api.test.ts
git commit -m "refactor: move ui sources under src"
```

## Task 4: Move `use/` Into `src/use/`

**Files:**
- Create: `src/use/**`
- Delete: `use/**`
- Modify: moved `src/use/**`
- Modify: `tests/bun-latest-api.test.ts`
- Modify: any use tests that reference `../use/...`

- [ ] **Step 1: Move the `use/` tree into `src/use/`**

- [ ] **Step 2: Update root-facing references**

Ensure references such as:

```ts
import { useTheme } from "../use/useTheme.ts";
```

are updated to the new physical layout where needed by root tests.

- [ ] **Step 3: Run focused hook tests**

Run:

```bash
bun test use
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/use tests/bun-latest-api.test.ts
git commit -m "refactor: move use sources under src"
```

## Task 5: Move `route/` Into `src/route/`

**Files:**
- Create: `src/route/**`
- Delete: `route/**`
- Modify: moved `src/route/**`
- Modify: `tests/bun-latest-api.test.ts`
- Modify: any route-specific README links or relative import references

- [ ] **Step 1: Move the full `route/` tree into `src/route/`**

- [ ] **Step 2: Update relative imports and test compile helpers**

Pay special attention to:

- `src/route/_.ts`
- `src/route/tests/**`
- route fixture imports
- any file path assumptions in tests

- [ ] **Step 3: Run focused route tests**

Run:

```bash
bun test --conditions=browser route/tests
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/route tests/bun-latest-api.test.ts
git commit -m "refactor: move route sources under src"
```

## Task 6: Move `builder/` Into `src/builder/`

**Files:**
- Create: `src/builder/**`
- Delete: `builder/**`
- Modify: moved `src/builder/**`
- Modify: `README.md`
- Modify: `demo/README.md`
- Modify: `docs/migrations/2026-04-latest-svelte5-migration.md`
- Modify: `tests/bun-latest-api.test.ts`

- [ ] **Step 1: Move the full `builder/` tree into `src/builder/`**

This includes:

- `build.ts`
- `dev.ts`
- `_.ts`
- README
- builder tests

- [ ] **Step 2: Update direct path references**

Examples:

```md
bun /._/svelte-lib/src/builder/build.ts
bun /._/svelte-lib/src/builder/dev.ts
```

Replace any remaining old `builder/...` physical paths in docs and tests.

- [ ] **Step 3: Run focused builder tests**

Run:

```bash
bun test builder/tests
```

Expected: PASS

- [ ] **Step 4: Verify builder entry points still work**

Run:

```bash
bun ./src/builder/build.ts --help
```

Expected: the file executes without path-resolution failures. If there is no `--help` support, use `bun run --cwd demo build` in Task 8 as the real validation.

- [ ] **Step 5: Commit**

```bash
git add src/builder README.md demo/README.md docs/migrations/2026-04-latest-svelte5-migration.md tests/bun-latest-api.test.ts
git commit -m "refactor: move builder sources under src"
```

## Task 7: Sweep Root Docs And Path Assertions

**Files:**
- Modify: `README.md`
- Modify: `tests/bun-latest-api.test.ts`
- Modify: `tests/package-policy.test.ts`
- Modify: `tests/package-exports.test.ts`

- [ ] **Step 1: Update root README**

Any repo-internal direct path examples must switch from:

```bash
bun /._/svelte-lib/builder/build.ts
```

to:

```bash
bun /._/svelte-lib/src/builder/build.ts
```

- [ ] **Step 2: Update all remaining file existence assertions**

Search for old root physical paths:

```bash
rg -n '"(ui|use|route|builder)/|/(ui|use|route|builder)/' README.md tests docs demo
```

Expected after cleanup: only public import names remain unless the reference intentionally names the old path in migration history.

- [ ] **Step 3: Run focused path-policy tests**

Run:

```bash
bun test tests/package-policy.test.ts tests/package-exports.test.ts tests/bun-latest-api.test.ts
```

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add README.md tests/package-policy.test.ts tests/package-exports.test.ts tests/bun-latest-api.test.ts
git commit -m "docs: align repository paths with src layout"
```

## Task 8: Verify Demo Still Works As A Consumer App

**Files:**
- Verify only: `demo/**`

- [ ] **Step 1: Build the demo**

Run:

```bash
bun run --cwd demo build
```

Expected: PASS and emits build output under `demo/dist/`.

- [ ] **Step 2: Start the demo dev server**

Run:

```bash
bun run --cwd demo dev
```

Expected: PASS, starts the dev server, and does not fail because of old repo-internal builder paths.

- [ ] **Step 3: Stop the dev server after smoke verification**

Expected: clean shutdown.

## Task 9: Run Full Repository Verification

**Files:**
- Verify only

- [ ] **Step 1: Run all tests**

Run:

```bash
bun run test
```

Expected: PASS

- [ ] **Step 2: Run typecheck**

Run:

```bash
bun run typecheck
```

Expected: PASS

- [ ] **Step 3: Search for stale physical paths**

Run:

```bash
rg -n '/(ui|use|route|builder)/|"(ui|use|route|builder)/' README.md docs tests demo package.json _.ts src
```

Expected: only intentional public import references or migration-history text remain. No stale repo-internal direct paths to old root directories.

- [ ] **Step 4: Final commit**

```bash
git add package.json _.ts README.md docs tests demo src
git commit -m "refactor: move package sources into root src tree"
```

## Rollback Notes

- Roll back by moving `src/ui`, `src/use`, `src/route`, `src/builder` back to root.
- Restore `package.json` `exports` and `bin`.
- Restore README/tests/docs direct paths.
- Because public subpath imports do not change, rollback is mostly a repository-internal path restoration.
