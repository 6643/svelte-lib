# Configured Mount Target Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `mountId` the single source of truth for application mounting, with Solid-compatible fallback creation when the configured DOM element is absent.

**Architecture:** Keep the public `builder.ts` shape and `mountId?: string` unchanged. Add one internal source generator in `src/builder/build-internals.ts` that emits a `getMountTarget()` resolver; both the generated application bootstrap and `createRuntimeModuleSource()` reuse that resolver. The resolver reuses an existing element, otherwise creates a `<div>` with the configured ID and appends it to `document.body`.

**Tech Stack:** Bun, TypeScript, Svelte 5, `bun:test`, jsdom, the existing `src/builder` test layout.

## Global Constraints

- `mountId` remains the only public mount configuration field, with the current default and validation rules.
- Existing `mount(App, { target })` and `createSvelteBunPlugin({ mode })` usage stays unchanged.
- The Bun compile plugin does not access browser DOM during `setup` or `onLoad`.
- Existing HTML shells still emit their configured mount element; fallback creation only handles pages that omit it.
- Missing targets create a `<div>` under `document.body`; existing targets are reused without clearing or replacing them.
- Missing `document.body` produces `Cannot create mount target before document.body exists`.
- No Vite, Rollup, selector-based mount configuration, parent/position configuration, or new runtime component API is introduced.
- Use focused tests before implementation, then run the repository standard test and typecheck commands.

---

### Task 1: Add failing mount resolver contracts

**Files:**
- Modify: `src/builder/tests/bootstrap.test.ts`
- Modify: `src/builder/tests/runtime.test.ts`

**Interfaces:**
- Consumes: current `createBootstrapSource()` and `createRuntimeModuleSource()` implementations.
- Produces: failing tests that define the shared resolver contract for Tasks 2 and 3.

- [x] **Step 1: Extend the bootstrap source test with the fallback contract**

In `src/builder/tests/bootstrap.test.ts`, keep the existing import/mount assertions and add assertions to the valid bootstrap case:

```ts
expect(source).toContain("const body = scope.body");
expect(source).toContain('scope.createElement("div")');
expect(source).toContain("target.id = mountId");
expect(source).toContain("body.append(target)");
expect(source).toContain('Cannot create mount target before document.body exists');
expect(source).not.toContain("Missing mount target");
```

Also update the custom-ID case to assert that the generated resolver keeps the configured ID as the source value:

```ts
expect(source).toContain('const mountId = "root"');
```

- [x] **Step 2: Add generated runtime behavior tests**

In `src/builder/tests/runtime.test.ts`, import jsdom and add a unique data-module loader so the generated JavaScript is executed rather than only inspected as text:

```ts
import { JSDOM } from "jsdom";

let runtimeModuleVersion = 0;

const loadRuntimeModule = async (mountId: string): Promise<{
  getMountTarget: (scope?: Document) => Element;
  mountId: string;
}> => {
  runtimeModuleVersion += 1;
  const source = createRuntimeModuleSource(mountId);
  return import(
    `data:text/javascript;charset=utf-8,${encodeURIComponent(`${source}\n//# sourceURL=svelte-lib-runtime-${runtimeModuleVersion}.js`)}`
  ) as Promise<{
    getMountTarget: (scope?: Document) => Element;
    mountId: string;
  }>;
};
```

Add these three tests:

```ts
it("reuses an existing configured target", async () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  const existing = dom.window.document.createElement("section");
  existing.id = "root";
  dom.window.document.body.append(existing);

  try {
    const runtime = await loadRuntimeModule("root");
    expect(runtime.getMountTarget(dom.window.document)).toBe(existing);
    expect(dom.window.document.querySelectorAll("#root").length).toBe(1);
  } finally {
    dom.window.close();
  }
});

it("creates and reuses a fallback target when the configured ID is absent", async () => {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");

  try {
    const runtime = await loadRuntimeModule("plugin-root");
    const first = runtime.getMountTarget(dom.window.document);
    const second = runtime.getMountTarget(dom.window.document);

    expect(first.tagName).toBe("DIV");
    expect(first.id).toBe("plugin-root");
    expect(first.parentElement).toBe(dom.window.document.body);
    expect(second).toBe(first);
    expect(dom.window.document.querySelectorAll("#plugin-root").length).toBe(1);
  } finally {
    dom.window.close();
  }
});

it("reports a missing document body while creating a fallback", async () => {
  const runtime = await loadRuntimeModule("root");
  const scope = {
    getElementById: () => null,
    createElement: () => ({ id: "" }),
    body: null,
  } as unknown as Document;

  expect(() => runtime.getMountTarget(scope)).toThrow(
    "Cannot create mount target before document.body exists",
  );
});
```

- [x] **Step 3: Run the focused tests and verify the failure is feature-related**

Run:

```bash
bun test --conditions=browser src/builder/tests/bootstrap.test.ts src/builder/tests/runtime.test.ts
```

Expected: the existing implementation fails because bootstrap still emits `Missing mount target`, does not create a `div`, and the runtime module throws before creating an element. Fix test syntax only if the test runner reports a test construction error; do not change production code in this step.

- [x] **Step 4: Commit the red tests**

```bash
git add src/builder/tests/bootstrap.test.ts src/builder/tests/runtime.test.ts
git commit -m "test(builder): define configured mount fallback"
```

### Task 2: Implement the shared mount target resolver

**Files:**
- Modify: `src/builder/build-internals.ts:204-263`
- Test: `src/builder/tests/bootstrap.test.ts`
- Test: `src/builder/tests/runtime.test.ts`

**Interfaces:**
- Consumes: the failing source and generated-runtime tests from Task 1.
- Produces: internal `createMountTargetResolverSource(mountId, exported)` output reused by both generated entry types; no new public export.

- [x] **Step 1: Add the minimal resolver source generator**

Add this internal generator immediately before `createBootstrapSource()`:

```ts
const createMountTargetResolverSource = (mountId: string, exported: boolean): string => {
    const exportKeyword = exported ? "export " : "";

    return [
        `${exportKeyword}const mountId = ${JSON.stringify(mountId)};`,
        `${exportKeyword}const getMountTarget = (scope = document) => {`,
        "    let target = scope.getElementById(mountId);",
        "    if (target) return target;",
        "    const body = scope.body;",
        '    if (!body) throw new Error("Cannot create mount target before document.body exists");',
        '    target = scope.createElement("div");',
        "    target.id = mountId;",
        "    body.append(target);",
        "    return target;",
        "};",
    ].join("\n");
};
```

The generated code must use `scope` for all DOM reads and writes so `createRuntimeModuleSource()` can be tested with a jsdom `Document` or a narrow fake scope.

- [x] **Step 2: Make the application bootstrap use the resolver**

In `createBootstrapSource()`, replace the direct lookup and missing-target throw with the generated resolver:

```ts
createMountTargetResolverSource(mountId, false),
"",
"const target = getMountTarget();",
```

Keep the existing component import, `mount(App, { target })`, and optional native HMR unmount/remount code unchanged.

- [x] **Step 3: Make the runtime module use the same resolver**

In `createRuntimeModuleSource()`, keep normalization and validation exactly as they are, then return:

```ts
return createMountTargetResolverSource(normalizedMountId, true);
```

Remove the obsolete `RuntimeElement` and `RuntimeMountScope` types if they are no longer referenced. Do not export the internal source generator through `src/builder/_.ts`.

- [x] **Step 4: Run the focused tests and verify green**

Run:

```bash
bun test --conditions=browser src/builder/tests/bootstrap.test.ts src/builder/tests/runtime.test.ts
```

Expected: all bootstrap and runtime tests pass, including existing-ID reuse, missing-ID creation, repeated resolver calls, and missing-body error handling.

- [x] **Step 5: Commit the implementation**

```bash
git add src/builder/build-internals.ts src/builder/tests/bootstrap.test.ts src/builder/tests/runtime.test.ts
git commit -m "feat(builder): create missing mount targets"
```

### Task 3: Verify all generated entry paths and document the contract

**Files:**
- Modify: `src/builder/README.md:56-65`
- Modify: `src/builder/tests/cli-entry.test.ts`
- Modify: `src/builder/tests/native-dev.test.ts`
- Test: existing `src/builder/tests/bootstrap.test.ts`

**Interfaces:**
- Consumes: the shared resolver output from Task 2.
- Produces: documented `mountId` fallback behavior and regression coverage for SSE dev/native generated entries while preserving existing HTML shell output.

- [x] **Step 1: Extend the dev entry regression assertion**

In the existing `dev server compiles local .svelte.ts rune modules` test, after the current `expect(entrySource).toContain("mount(App")` assertion, add:

```ts
expect(entrySource).toContain('scope.createElement("div")');
expect(entrySource).toContain("body.append(target)");
expect(entrySource).not.toContain("Missing mount target");
```

- [x] **Step 2: Extend the native workspace entry regression assertion**

In `src/builder/tests/native-dev.test.ts`, after the existing native entry assertions, add the same generated-entry contract:

```ts
expect(entry).toContain('scope.createElement("div")');
expect(entry).toContain("body.append(target)");
expect(entry).not.toContain("Missing mount target");
```

Keep the existing assertion that native HTML still contains the configured `id`, proving the shell continues to own the normal mount root.

- [x] **Step 3: Update the builder README**

Change the `mountId` row in `src/builder/README.md` to state:

```md
| `mountId` | `"app"` | build/dev 会使用该 DOM `id`; HTML shell 默认预生成对应节点, 如果外部页面缺少该节点, bootstrap 会创建 `<div id="...">` 并追加到 `document.body` |
```

Add one short paragraph below the table clarifying that `mountId` remains an ID token, not a CSS selector, and the compile plugin does not perform DOM mounting during Bun `setup`/`onLoad`.

- [x] **Step 4: Run the builder regression tests**

Run:

```bash
bun test --conditions=browser src/builder/tests/cli-entry.test.ts src/builder/tests/native-dev.test.ts src/builder/tests/build-plugins.test.ts
```

Expected: all selected builder tests pass, including existing HTML shell and plugin pipeline behavior.

- [x] **Step 5: Commit documentation and integration coverage**

```bash
git add src/builder/README.md src/builder/tests/cli-entry.test.ts src/builder/tests/native-dev.test.ts
git commit -m "test(builder): cover mount fallback in dev entries"
```

### Task 4: Run the complete verification gate

**Files:**
- No source changes expected unless a verification command identifies a regression in Tasks 1-3.

**Interfaces:**
- Consumes: the committed mount fallback implementation and integration coverage.
- Produces: evidence that the configured mount behavior does not regress the package, demo, or browser-conditioned test suite.

- [x] **Step 1: Run the complete browser-conditioned test suite**

Run:

```bash
bun test --conditions=browser
```

Expected: zero failed tests. Existing unrelated dirty files remain untouched if the suite produces generated artifacts.

- [x] **Step 2: Run root typecheck**

Run:

```bash
bun run typecheck
```

Expected: `svelte-check` reports zero errors and zero warnings.

- [x] **Step 3: Verify the demo consumer workflow**

Run:

```bash
bun run check
bun run build
```

from `demo/`.

Expected: demo check reports zero diagnostics and the demo build succeeds while retaining one builder-owned `main#app` in the generated HTML.

- [x] **Step 4: Check patch formatting and scope**

Run:

```bash
git diff --check HEAD~3..HEAD
git status --short
```

Expected: no whitespace errors; the final report distinguishes the three feature commits from pre-existing dirty/untracked files and does not claim unrelated files were cleaned.

- [x] **Step 5: Record verification evidence**

Verification result: focused mount tests passed 15/15, builder regression tests passed 15/15, full browser-conditioned suite passed 171/171 with 574 assertions, root `bun run typecheck` reported 0 errors and 0 warnings, demo `bun run check` reported 0 errors and 0 warnings, demo `bun run build` succeeded, and `git diff --check HEAD~3..HEAD` produced no output.
