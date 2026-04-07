# UI Shared Chunk Pruning Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prune unused `svelte-lib/ui` modules out of the demo app's largest shared browser chunk without changing any public import paths.

**Architecture:** This plan only covers the first corrective pass from the approved pruning spec. First lock the current bug as a build-artifact regression against the demo's largest emitted JS chunk, then add the smallest package-level tree-shaking metadata fix, and stop there if the chunk leak disappears. Do not refactor `ui`, `route`, or `builder` internals in this plan.

**Tech Stack:** Bun, TypeScript, Svelte 5, existing demo app, package metadata, Bun test

---

### Task 1: Lock The Shared Chunk Leak As A Regression Test

**Files:**
- Create: `tests/demo-ui-shared-chunk.test.ts`
- Read: `demo/dist/*.js`

- [ ] **Step 1: Write the failing test**

Create `tests/demo-ui-shared-chunk.test.ts` with:

```ts
import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const distDir = resolve(import.meta.dir, "../demo/dist");

const readLargestJsChunk = () => {
    const jsFiles = readdirSync(distDir).filter((file) => file.endsWith(".js"));

    const largestFile = jsFiles
        .map((file) => ({
            file,
            size: readFileSync(resolve(distDir, file)).byteLength,
        }))
        .sort((left, right) => right.size - left.size)[0];

    if (!largestFile) {
        throw new Error("Expected demo/dist to contain at least one JS asset");
    }

    return {
        file: largestFile.file,
        source: readFileSync(resolve(distDir, largestFile.file), "utf8"),
    };
};

test("demo largest shared chunk excludes unused ui modules", () => {
    const { source } = readLargestJsChunk();

    expect(source.includes("swiper-container")).toBe(false);
    expect(source.includes("drag-handle")).toBe(false);
    expect(source.includes("<video")).toBe(false);
});
```

- [ ] **Step 2: Build the demo before running the regression**

Run: `bun run --cwd demo build`
Expected: PASS

- [ ] **Step 3: Run the regression test to verify it fails**

Run: `bun test tests/demo-ui-shared-chunk.test.ts`
Expected: FAIL because the current largest shared chunk still contains `swiper-container`, `drag-handle`, and `<video`.

### Task 2: Lock The Package Metadata Contract

**Files:**
- Modify: `tests/package-policy.test.ts`
- Read: `package.json`

- [ ] **Step 1: Extend the package policy test with the missing contract**

Update `tests/package-policy.test.ts` so the typed JSON shape includes `sideEffects?: boolean | string[];` and add this assertion to the root package policy test:

```ts
expect(rootPackage.sideEffects).toBe(false);
```

- [ ] **Step 2: Run the focused policy test to verify it fails**

Run: `bun test tests/package-policy.test.ts`
Expected: FAIL because `package.json` does not yet define `sideEffects`.

### Task 3: Apply The Smallest Tree-Shaking Fix

**Files:**
- Modify: `package.json`
- Test: `tests/package-policy.test.ts`
- Test: `tests/demo-ui-shared-chunk.test.ts`

- [ ] **Step 1: Add the minimal package metadata**

Update `package.json` so it includes:

```json
"sideEffects": false,
```

Place it at the top-level package metadata alongside the existing `files`, `type`, and `exports` fields. Do not change public exports or script names.

- [ ] **Step 2: Re-run the focused policy test**

Run: `bun test tests/package-policy.test.ts`
Expected: PASS

- [ ] **Step 3: Rebuild the demo**

Run: `bun run --cwd demo build`
Expected: PASS

- [ ] **Step 4: Re-run the shared chunk regression**

Run: `bun test tests/demo-ui-shared-chunk.test.ts`
Expected: PASS because the largest emitted JS chunk no longer contains `swiper-container`, `drag-handle`, or `<video`.

- [ ] **Step 5: Stop immediately if Step 4 still fails**

Do not continue into `ui` export refactoring inside this plan.

If `bun test tests/demo-ui-shared-chunk.test.ts` still fails after the metadata change:

1. keep the worktree changes uncommitted
2. report that the metadata fix was insufficient
3. write a separate follow-up spec / plan for `ui` export boundary splitting

### Task 4: Verify The Minimal Fix Did Not Regress Local Consumption

**Files:**
- Verify only

- [ ] **Step 1: Run demo typecheck**

Run: `bun run --cwd demo typecheck`
Expected: PASS with `0 errors / 0 warnings`

- [ ] **Step 2: Run root typecheck**

Run: `bun run typecheck`
Expected: PASS with `0 errors / 0 warnings`

- [ ] **Step 3: Run the combined focused checks**

Run: `bun test tests/package-policy.test.ts tests/demo-ui-shared-chunk.test.ts`
Expected: PASS

### Task 5: Commit The Successful Metadata Fix

**Files:**
- Modify: `package.json`
- Modify: `tests/package-policy.test.ts`
- Create: `tests/demo-ui-shared-chunk.test.ts`

- [ ] **Step 1: Commit**

```bash
git add package.json tests/package-policy.test.ts tests/demo-ui-shared-chunk.test.ts
git commit -m "perf: prune unused ui modules from demo shared chunk"
```

---

This plan intentionally stops after the metadata path. If it does not turn the shared chunk regression green, write a separate follow-up plan for `ui` export-boundary splitting rather than extending this one in place.
