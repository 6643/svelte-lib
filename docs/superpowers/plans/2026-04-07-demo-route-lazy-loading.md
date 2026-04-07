# Demo Route Lazy Loading Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce the demo app's browser entry bundle by lazy-loading non-home routes while keeping the public `svelte-lib/route` API unchanged.

**Architecture:** This plan only covers phase 1 from the approved slimming spec. Keep `Home` as the synchronous route, convert `Profile` and `NotFound` to lazy route loaders in `demo/src/App.svelte`, and lock the source-level contract with a focused regression test before verifying the emitted build artifacts. Do not refactor `route` or `builder` internals in this phase.

**Tech Stack:** Bun, TypeScript, Svelte 5, existing demo app and test suite

---

### Task 1: Lock The Demo Route Loading Policy

**Files:**
- Create: `tests/demo-route-loading.test.ts`
- Read: `demo/src/App.svelte`

- [ ] **Step 1: Write the failing test**

Create `tests/demo-route-loading.test.ts` with:

```ts
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

test("demo app lazy-loads non-home routes while keeping Home eager", () => {
    const appSource = readFileSync(new URL("../demo/src/App.svelte", import.meta.url), "utf8");

    expect(appSource.includes('import Home from "./routes/Home.svelte";')).toBe(true);
    expect(appSource.includes('import Profile from "./routes/Profile.svelte";')).toBe(false);
    expect(appSource.includes('import NotFound from "./routes/NotFound.svelte";')).toBe(false);
    expect(appSource.includes('component={() => import("./routes/Profile.svelte")} $name={String}')).toBe(true);
    expect(appSource.includes('component={() => import("./routes/NotFound.svelte")}')).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tests/demo-route-loading.test.ts`
Expected: FAIL because `Profile` and `NotFound` are still statically imported in `demo/src/App.svelte`.

### Task 2: Convert Non-Home Demo Routes To Lazy Loaders

**Files:**
- Modify: `demo/src/App.svelte`
- Test: `tests/demo-route-loading.test.ts`

- [ ] **Step 1: Write minimal implementation**

Update `demo/src/App.svelte` so the imports and route declarations become:

```svelte
import Home from "./routes/Home.svelte";
```

and:

```svelte
<Route path="/" component={Home} />
<Route path="/lazy" component={() => import("./routes/LazyProfile.svelte")} $name={String} />
<Route path="/profile" component={() => import("./routes/Profile.svelte")} $name={String} />
<Route path="*" component={() => import("./routes/NotFound.svelte")} />
```

Do not change route paths, query decoders, button behavior, or page copy.

- [ ] **Step 2: Run the focused regression test**

Run: `bun test tests/demo-route-loading.test.ts`
Expected: PASS

- [ ] **Step 3: Run demo typecheck**

Run: `bun run --cwd demo typecheck`
Expected: PASS with `0 errors / 0 warnings`

### Task 3: Verify The Bundle Actually Got Smaller

**Files:**
- Verify only

- [ ] **Step 1: Build the demo**

Run: `bun run --cwd demo build`
Expected: PASS

- [ ] **Step 2: Inspect emitted JS assets**

Run: `find demo/dist -maxdepth 1 -name '*.js' -printf '%s %f\n' | sort -nr`
Expected:
- the command lists the emitted entry and lazy chunks
- the largest emitted JS file is smaller than the current pre-change baseline `72267` bytes

- [ ] **Step 3: Commit**

```bash
git add tests/demo-route-loading.test.ts demo/src/App.svelte
git commit -m "perf: lazy-load non-home demo routes"
```

---

This plan intentionally stops after phase 1. If it lands cleanly, write separate plans for:

1. `route` internal responsibility splitting
2. `builder` internal responsibility splitting
