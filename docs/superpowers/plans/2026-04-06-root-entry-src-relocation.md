# Root Entry `_.ts` Relocation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the root package aggregator from `_.ts` to `src/_.ts` while keeping `import "svelte-lib"` unchanged.

**Architecture:** Treat this as a root package entry-point relocation only. First lock the new `./src/_.ts` package contract with failing tests, then move the aggregator file and retarget `package.json` so the root `.` export and `module` field both resolve through `src/_.ts`. Do not add a root shim and do not touch subpath exports beyond what is required for regression coverage.

**Tech Stack:** Bun, TypeScript, package `exports`, Bun test, `svelte-check`

---

## File Map

### Keep Unchanged

- `src/ui/**`
- `src/use/**`
- `src/route/**`
- `src/builder/**`
- `demo/**`

### Move

- `_.ts` -> `src/_.ts`

### Modify

- `package.json`
- `tests/package-exports.test.ts`
- `tests/package-policy.test.ts`

## Task 1: Lock The Root Entry Contract

**Files:**
- Modify: `tests/package-exports.test.ts`
- Modify: `tests/package-policy.test.ts`

- [ ] **Step 1: Write the failing contract changes**

Update the tests so they assert:

```ts
// tests/package-exports.test.ts
import * as lib from "../src/_.ts";
```

```ts
// tests/package-policy.test.ts
expect(rootPackage.exports).toEqual({
  ".": "./src/_.ts",
  "./ui": "./src/ui/_.ts",
  "./use": "./src/use/_.ts",
  "./route": "./src/route/_.ts",
  "./builder": "./src/builder/_.ts",
  "./package.json": "./package.json",
});
```

If the test also checks the top-level module entry, update it to expect:

```ts
expect(rootPackage.module).toBe("./src/_.ts");
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run:

```bash
bun test tests/package-exports.test.ts tests/package-policy.test.ts
```

Expected:

- `tests/package-exports.test.ts` fails because `../src/_.ts` does not exist yet
- `tests/package-policy.test.ts` fails because `package.json` still points `.` / `module` at `./_.ts`

## Task 2: Move The Root Aggregator And Retarget Package Entry

**Files:**
- Create: `src/_.ts`
- Delete: `_.ts`
- Modify: `package.json`

- [ ] **Step 1: Move the root aggregator into `src/_.ts`**

Create `src/_.ts` with the existing root re-exports:

```ts
export * from "./ui/_.ts";
export * from "./use/_.ts";
```

Then remove the old root `_.ts`.

- [ ] **Step 2: Update `package.json` root entry fields**

Set:

```json
"module": "./src/_.ts",
"exports": {
  ".": "./src/_.ts",
  "./ui": "./src/ui/_.ts",
  "./use": "./src/use/_.ts",
  "./route": "./src/route/_.ts",
  "./builder": "./src/builder/_.ts",
  "./package.json": "./package.json"
}
```

- [ ] **Step 3: Run focused tests to verify green**

Run:

```bash
bun test tests/package-exports.test.ts tests/package-policy.test.ts
```

Expected: PASS

## Task 3: Regress The Root Entry And Scan For Stale Root Path Links

**Files:**
- Verify only

- [ ] **Step 1: Run the full test suite**

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

- [ ] **Step 3: Build the demo as a consumer smoke test**

Run:

```bash
bun run --cwd demo build
```

Expected: PASS

- [ ] **Step 4: Search for stale root `_.ts` references**

Run:

```bash
rg -n '"\\./_\\.ts"|\\.\\./_\\.ts|import \\* as lib from "\\.\\./_\\.ts"|\\b_\\.ts\\b' README.md docs tests demo src package.json tsconfig.json -g '!docs/superpowers/**'
```

Expected:

- only intentional `src/_.ts` references remain
- no package contract still points root `.` at `./_.ts`

## Rollback Notes

- Move `src/_.ts` back to `_.ts`
- Restore `package.json#module` to `./_.ts`
- Restore `package.json#exports["."]` to `./_.ts`
- Restore tests that import or assert the root entry path
