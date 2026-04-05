# Top Level Demo Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a complete top-level `demo/` app that consumes `svelte-lib` through its public entry points while staying outside the package export surface.

**Architecture:** Keep the existing top-level library capability directories unchanged, add `demo/` as an isolated consumer project with its own `builder.ts` and `src/App.svelte`, and enforce the boundary with a repository-level regression test plus README documentation.

**Tech Stack:** Bun, Svelte 5, TypeScript, local file dependency, `svelte-lib/builder`

---

## File Map

- Modify: `README.md`
- Modify: `.gitignore`
- Modify: `tests/package-policy.test.ts`
- Create: `demo/package.json`
- Create: `demo/builder.ts`
- Create: `demo/src/App.svelte`
- Create: `demo/assets/.gitkeep`

## Task 1: Lock the Demo Boundary with a Failing Test

**Files:**
- Modify: `tests/package-policy.test.ts`

- [ ] **Step 1: Write the failing test**

Add a test that asserts:

- `demo/package.json` exists
- `demo/builder.ts` exists
- `demo/src/App.svelte` exists
- the root package `exports` does not contain `./demo`

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `bun test tests/package-policy.test.ts`
Expected: FAIL because the `demo/` files do not exist yet.

- [ ] **Step 3: Keep the test unchanged and move to implementation**

No production code changes in this task.

## Task 2: Create the Minimal Demo Consumer App

**Files:**
- Create: `demo/package.json`
- Create: `demo/builder.ts`
- Create: `demo/src/App.svelte`
- Create: `demo/assets/.gitkeep`
- Modify: `.gitignore`

- [ ] **Step 1: Add the sample app manifest**

Create `demo/package.json` with:

- `"private": true`
- a local dependency on `"svelte-lib": ".."`
- `svelte` as a direct dependency for the demo app
- scripts for `dev` and `build` that call the builder entry points from the installed package

- [ ] **Step 2: Add the sample builder config**

Create `demo/builder.ts` with a minimal default export:

- `appComponent: "src/App.svelte"`
- `appTitle` set to a demo-specific title

- [ ] **Step 3: Add the sample Svelte app**

Create `demo/src/App.svelte` that demonstrates the library's public surface in one page:

- imports UI components from `svelte-lib/ui`
- uses at least one `use/*` helper
- mounts at least one `Route` example or route helper from `svelte-lib/route`
- avoids deep imports into repository internals

- [ ] **Step 4: Add minimal asset and ignore coverage**

- create `demo/assets/.gitkeep`
- ignore `demo/node_modules`, `demo/dist`, and demo-local builder cache output in `.gitignore`

- [ ] **Step 5: Re-run the targeted test**

Run: `bun test tests/package-policy.test.ts`
Expected: PASS.

## Task 3: Document the Demo Entry

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add a demo section**

Document:

- the purpose of `demo/`
- how to install dependencies inside `demo/`
- how to run dev/build there

- [ ] **Step 2: Keep the wording explicit**

State that `demo/` is a sample app and not a package export path.

## Task 4: Validate the Repository Boundary

**Files:**
- Modify: `README.md`
- Modify: `tests/package-policy.test.ts`
- Create: `demo/*`

- [ ] **Step 1: Run targeted verification**

Run: `bun test tests/package-policy.test.ts`
Expected: PASS.

- [ ] **Step 2: Run repository verification**

Run: `bun test --conditions=browser`
Expected: PASS.

- [ ] **Step 3: Run type checking**

Run: `bun run typecheck`
Expected: PASS.

- [ ] **Step 4: Optionally smoke-test the demo app**

Run inside `demo/` after install: `bun run build`
Expected: PASS and emits demo build output under `demo/dist/`.
