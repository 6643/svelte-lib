# Aggressive Latest Modernization Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggressively modernize the repository to current official patterns, removing remaining legacy Svelte APIs from active code in scope while keeping the repository verifiably working.

**Architecture:** Execute modernization in three phases: `ui`, then `route`, then `builder`. Each phase begins with failing tests or policy assertions, performs the minimal modernization to satisfy the new standard, and ends with fresh verification before moving on. This keeps breaking structural changes controlled while preserving overall repository health.

**Tech Stack:** Svelte 5, Bun, TypeScript, Bun test, svelte-check

---

## File Map

### Phase 1: UI Modernization

- Modify: `ui/Block.svelte`
- Modify: `ui/Button.filled.svelte`
- Modify: `ui/Button.icon.svelte`
- Modify: `ui/Button.text.svelte`
- Modify: `ui/Input.range.svelte`
- Modify: `ui/Input.string.svelte`
- Modify: `ui/Modal.filled.svelte`
- Modify: `ui/Plyr.svelte`
- Modify: `ui/Swiper.svelte`
- Modify: `tests/bun-latest-api.test.ts`
- Modify: `tests/ui.snippet-components.test.ts`
- Modify: `README.md`
- Modify: `docs/migrations/2026-04-latest-svelte5-migration.md`
- Modify: any UI-specific fixtures/tests needed to match new component internals

### Phase 2: Route Modernization

- Modify: `route/Route.svelte`
- Modify: any remaining route runtime file that still needs modernization after verification
- Modify: `tests/route.route-component.test.ts`
- Modify: `tests/route.router-runtime.test.ts`
- Modify: `tests/route.query-navigation-history.test.ts`
- Modify: `route/README.md`
- Modify: route fixtures and helpers in `tests/route.fixture.*` and `tests/route.helper.compile-svelte.ts` as needed

### Phase 3: Builder Modernization

- Modify: `builder/build.ts`
- Modify: `builder/dev.ts`
- Modify: `builder/runtime.ts`
- Modify: `builder/bootstrap.ts`
- Modify: `builder/finalize-css.ts`
- Modify: `builder/finalize-js.ts`
- Modify: `builder/source-modules.ts`
- Modify: `builder/assets.ts`
- Modify: `builder/report.ts`
- Modify: `builder/load-config-runner.ts`
- Modify: `builder/strip-svelte-diagnostics.ts`
- Modify: `builder/README.md`
- Modify: builder tests only where modernization genuinely requires it

## Task 1: Modernize `ui` To Runes-First Style

**Files:**
- Modify: `ui/Block.svelte`
- Modify: `ui/Button.filled.svelte`
- Modify: `ui/Button.icon.svelte`
- Modify: `ui/Button.text.svelte`
- Modify: `ui/Input.range.svelte`
- Modify: `ui/Input.string.svelte`
- Modify: `ui/Modal.filled.svelte`
- Modify: `ui/Plyr.svelte`
- Modify: `ui/Swiper.svelte`
- Modify: `tests/bun-latest-api.test.ts`
- Modify: `tests/ui.snippet-components.test.ts`
- Modify: `README.md`
- Modify: `docs/migrations/2026-04-latest-svelte5-migration.md`

- [ ] **Step 1: Write the failing modernization policy test**

Extend `tests/bun-latest-api.test.ts` with a new assertion that targeted `ui` Svelte files no longer contain:

```ts
/\bexport let\b/
/\n\s*\$:\s/
```

Apply it to:

```ts
[
  "ui/Block.svelte",
  "ui/Button.filled.svelte",
  "ui/Button.icon.svelte",
  "ui/Button.text.svelte",
  "ui/Input.range.svelte",
  "ui/Input.string.svelte",
  "ui/Modal.filled.svelte",
  "ui/Plyr.svelte",
  "ui/Swiper.svelte"
]
```

- [ ] **Step 2: Run the targeted policy test and verify it fails**

Run:

```bash
bun test --conditions=browser --test-name-pattern "ui modernization removes export let and reactive label syntax" tests/bun-latest-api.test.ts
```

Expected: FAIL because the listed UI components still use `export let` and/or `$:`.

- [ ] **Step 3: Rewrite props and reactive logic to runes**

Modernization rules:

- `export let ...` -> `let { ... } = $props<...>()`
- `$:` derivations -> `$derived(...)` or `$derived.by(...)`
- `$:` effects -> `$effect(...)`
- preserve event attributes and snippets already in place
- only keep `onMount` if its semantics cannot be cleanly expressed via `$effect`

Examples of target style:

```svelte
<script lang="ts">
  import type { Snippet } from "svelte";

  type Props = {
    label?: string;
    value?: string;
    left?: Snippet;
    right?: Snippet;
  };

  let {
    label = "",
    value = "",
    left,
    right
  }: Props = $props();

  let currentValue = $state(value);
  let error = $derived(validate?.(currentValue));
</script>
```

- [ ] **Step 4: Run UI-focused tests**

Run:

```bash
bun test --conditions=browser tests/ui.snippet-components.test.ts tests/ui.Swiper.test.ts tests/ui.Swiper.bundle-loader.test.ts tests/ui.Swiper.video-autoplay.test.ts tests/ui.SortListBox.test.ts tests/ui.SortListBox.drag-layout.test.ts tests/ui.SortListBox.reorder.test.ts
bun test --conditions=browser --test-name-pattern "ui modernization removes export let and reactive label syntax" tests/bun-latest-api.test.ts
```

Expected: PASS.

- [ ] **Step 5: Update UI-facing docs**

Review and modernize the user-facing examples so they no longer preserve legacy Svelte component patterns. At minimum, update:

- `README.md`
- `docs/migrations/2026-04-latest-svelte5-migration.md`

Ensure examples and descriptive text align with the rune-style component internals produced in this task.

- [ ] **Step 6: Run repository verification and commit**

Run:

```bash
bun run test
bun run typecheck
```

Expected: PASS, with at most the existing non-blocking warning in `ui/SortListBox.svelte`.

Commit:

```bash
git add ui tests/bun-latest-api.test.ts tests/ui.snippet-components.test.ts README.md docs/migrations/2026-04-latest-svelte5-migration.md
git commit -m "refactor: modernize ui components to runes"
```

## Task 2: Modernize `route` Runtime And Supporting Tests

**Files:**
- Modify: `route/Route.svelte`
- Modify: `tests/route.route-component.test.ts`
- Modify: `tests/route.router-runtime.test.ts`
- Modify: `tests/route.query-navigation-history.test.ts`
- Modify: `route/README.md`
- Modify: route fixtures and helper files in `tests/route.fixture.*` and `tests/route.helper.compile-svelte.ts` as needed

- [ ] **Step 1: Write the failing route modernization policy test**

Extend `tests/bun-latest-api.test.ts` with a new assertion that `route/Route.svelte` no longer contains:

```ts
/\bexport let\b/
/\n\s*\$:\s/
```

If additional route runtime files end up in scope during implementation, add them to the same policy test.

- [ ] **Step 2: Run the targeted policy test and verify it fails**

Run:

```bash
bun test --conditions=browser --test-name-pattern "route modernization removes legacy component syntax" tests/bun-latest-api.test.ts
```

Expected: FAIL until `route/Route.svelte` is fully modernized.

- [ ] **Step 3: Modernize route runtime and fixtures**

Modernize `route/Route.svelte` and any route-supporting Svelte fixtures/helpers that still rely on older component syntax:

- use `$props`
- replace `$:` with `$derived` / `$effect`
- preserve tested runtime behavior
- do not change public route exports unless absolutely necessary

- [ ] **Step 4: Run route-focused tests**

Run:

```bash
bun test --conditions=browser tests/route.public-api.test.ts tests/route.query-navigation-history.test.ts tests/route.route-component.test.ts tests/route.router-runtime.test.ts
bun test --conditions=browser --test-name-pattern "route modernization removes legacy component syntax" tests/bun-latest-api.test.ts
```

Expected: PASS.

- [ ] **Step 5: Update route-facing docs**

Review `route/README.md` and remove any descriptive language or examples that still normalize legacy Svelte style when the runtime and tests have moved on.

- [ ] **Step 6: Run repository verification and commit**

Run:

```bash
bun run test
bun run typecheck
```

Expected: PASS, with at most the existing non-blocking warning in `ui/SortListBox.svelte`.

Commit:

```bash
git add route tests/bun-latest-api.test.ts tests/route.* route/README.md
git commit -m "refactor: modernize route to latest svelte style"
```

## Task 3: Modernize `builder` Where Safe

**Files:**
- Modify: builder runtime/support files only where modernization is clearly safe
- Modify: `builder/README.md`
- Modify: builder tests if required by the code changes

- [ ] **Step 1: Write the failing builder modernization policy test**

Add a targeted test in `tests/bun-latest-api.test.ts` that checks selected builder support files for remaining legacy Svelte component syntax only where applicable. Do not add a fake rule for files that are not `.svelte` components.

At minimum, verify that no builder-owned Svelte component file in scope still uses:

```ts
/\bexport let\b/
/\n\s*\$:\s/
```

If there are no remaining builder Svelte components in scope, explicitly state that in the test comment and skip adding a meaningless failing assertion.

- [ ] **Step 2: Run the targeted builder policy test and verify the current status**

Run:

```bash
bun test --conditions=browser --test-name-pattern "builder modernization" tests/bun-latest-api.test.ts
```

Expected:

- If the new builder-focused policy test is meaningful, FAIL until the builder modernization work is complete
- If there are no builder-owned legacy Svelte component files left in scope, PASS with an explicit in-test comment explaining why this phase is runtime/support-code modernization rather than component-syntax cleanup

- [ ] **Step 3: Review builder files and identify safe modernization targets**

Focus on modernizing only code that improves alignment without risking builder behavior. Examples:

- use clearer typed helpers
- remove outdated style only where semantics remain unchanged
- preserve current runtime constraints around Svelte internals where required

Stop and surface if a proposed builder modernization would require speculative runtime redesign.

- [ ] **Step 4: Run builder-focused verification**

Run:

```bash
bun test builder/tests/assets.test.ts builder/tests/compiler-import.test.ts builder/tests/dev-proxy.test.ts builder/tests/dev-watch-events.test.ts builder/tests/finalize-css.test.ts builder/tests/finalize-js.test.ts builder/tests/load-config.test.ts builder/tests/svelte-runtime-alias.test.ts
bun run builder:build
```

Expected: PASS.

- [ ] **Step 5: Update builder docs**

Review `builder/README.md` and bring its descriptive text in line with the final modernization boundary. Remove stale guidance that implies legacy style is still the preferred maintained pattern.

- [ ] **Step 6: Run final repository verification and commit**

Run:

```bash
bun run test
bun run typecheck
bun run builder:build
```

Expected: PASS, with at most the existing non-blocking warning in `ui/SortListBox.svelte`.

Commit:

```bash
git add builder tests/bun-latest-api.test.ts builder/README.md
git commit -m "refactor: modernize builder support code"
```
