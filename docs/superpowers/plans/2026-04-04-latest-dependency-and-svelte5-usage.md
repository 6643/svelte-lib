# Latest Dependency And Svelte 5 Usage Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refresh root and `builder/` dependencies to the latest resolved versions, migrate the repository's public Svelte usage to current Svelte 5 patterns, and preserve build/test behavior with explicit coverage of the `builder` internal-runtime boundary.

**Architecture:** Keep the repository on its existing `latest` package policy, move stale version assertions into explicit package-policy tests, migrate public UI components from slot and `on:` syntax to snippet and event-attribute syntax with focused regression tests, and modernize Bun typing in `builder` while documenting and validating any intentional Svelte internal coupling that remains.

**Tech Stack:** Bun, Svelte 5, TypeScript 6, jsdom, esbuild, Bun test

---

## File Map

### Policy, Dependency, and Tooling Files

- Modify: `tsconfig.json`
- Modify: `bun.lock`
- Modify: `builder/bun.lock`
- Modify: `tests/bun-latest-api.test.ts`
- Modify: `route/tests/query-navigation-history.test.ts`
- Create: `tests/package-policy.test.ts`

### Public Svelte 5 Usage Files

- Modify: `ui/box/Block.svelte`
- Modify: `ui/input/StringInput.svelte`
- Modify: `ui/input/RangeInput.svelte`
- Modify: `ui/modal/FilledModal.svelte`
- Modify: `ui/swiper/Swiper.svelte`
- Modify: `ui/button/FilledButton.svelte`
- Modify: `ui/button/IconButton.svelte`
- Modify: `ui/button/TextButton.svelte`
- Modify: `ui/plyr/Plyr.svelte`
- Create: `tests/helpers/svelte-client.ts`
- Create: `ui/tests/snippet-components.test.ts`
- Create: `ui/tests/fixtures/BlockHarness.svelte`
- Create: `ui/tests/fixtures/StringInputHarness.svelte`
- Create: `ui/tests/fixtures/RangeInputHarness.svelte`
- Create: `ui/tests/fixtures/FilledModalHarness.svelte`
- Create: `ui/tests/fixtures/SwiperHarness.svelte`
- Modify: `route/tests/route-component.test.ts`
- Modify: `ui/swiper/Swiper.test.ts`
- Modify: `ui/sort-list-box/SortListBox.test.ts`
- Modify: `README.md`
- Modify: `docs/migrations/2026-04-latest-svelte5-migration.md`

### Builder Compatibility Files

- Modify: `builder/build.ts`
- Modify: `builder/dev.ts`
- Modify: `builder/finalize-css.ts`
- Modify: `builder/finalize-js.ts`
- Modify: `builder/tests/finalize-js.test.ts`
- Modify: `builder/tests/svelte-runtime-alias.test.ts`
- Modify: `builder/src/types.d.ts`
- Modify: `builder/README.md`

### Bun Execution Preflight

Use the same Bun discovery snippet for every command in this plan:

```bash
BUN_BIN="$(command -v bun || find "$HOME" /._ -path '*/bin/bun' -type f 2>/dev/null | head -n 1)"
test -n "$BUN_BIN"
"$BUN_BIN" --version
```

Expected: prints a Bun version and exits `0`. If `test -n "$BUN_BIN"` fails, stop and get a working Bun binary before continuing, because lockfile refresh and validation cannot proceed.

### Task 1: Align Package Policy and Root Tooling Baseline

**Files:**
- Create: `tests/package-policy.test.ts`
- Modify: `route/tests/query-navigation-history.test.ts`
- Modify: `tests/bun-latest-api.test.ts`
- Modify: `tsconfig.json`
- Modify: `bun.lock`

- [ ] **Step 1: Write the failing package-policy test**

```ts
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const readJson = (path: URL) => JSON.parse(readFileSync(path, "utf8")) as {
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
};

test("root and builder packages follow the repository latest policy", () => {
    const rootPackage = readJson(new URL("../package.json", import.meta.url));
    const builderPackage = readJson(new URL("../builder/package.json", import.meta.url));

    expect(rootPackage.devDependencies).toMatchObject({
        "@types/bun": "latest",
        "@types/node": "latest",
        jsdom: "latest",
        svelte: "latest",
        "svelte-check": "latest",
        typescript: "latest",
    });
    expect(rootPackage.peerDependencies).toEqual({ svelte: "latest", typescript: "latest" });
    expect(builderPackage.devDependencies).toMatchObject({
        "@types/bun": "latest",
        "@types/node": "latest",
        esbuild: "latest",
        svelte: "latest",
    });
    expect(builderPackage.peerDependencies).toEqual({ svelte: "latest", typescript: "latest" });
});
```

- [ ] **Step 2: Run the targeted tests to verify the baseline is red**

Run:

```bash
BUN_BIN="$(command -v bun || find "$HOME" /._ -path '*/bin/bun' -type f 2>/dev/null | head -n 1)"
test -n "$BUN_BIN"
"$BUN_BIN" test tests/package-policy.test.ts tests/bun-latest-api.test.ts route/tests/query-navigation-history.test.ts
```

Expected: FAIL because `tsconfig.json` still uses `"bun-types"` and `route/tests/query-navigation-history.test.ts` still hardcodes stale exact version assertions.

- [ ] **Step 3: Implement the minimal policy and config realignment**

```json
// tsconfig.json
{
  "compilerOptions": {
    "types": ["bun", "node", "svelte"]
  }
}
```

```ts
// route/tests/query-navigation-history.test.ts
// Delete the "package metadata" describe block entirely so route tests stay route-focused.
```

```ts
// tests/bun-latest-api.test.ts
expect(tsconfig.compilerOptions?.types).toEqual(["bun", "node", "svelte"]);
```

- [ ] **Step 4: Refresh the root lockfile**

Run:

```bash
BUN_BIN="$(command -v bun || find "$HOME" /._ -path '*/bin/bun' -type f 2>/dev/null | head -n 1)"
test -n "$BUN_BIN"
"$BUN_BIN" install
```

Expected: exits `0` and rewrites `bun.lock` if the latest resolution set changes.

- [ ] **Step 5: Re-run the targeted tests and commit**

Run:

```bash
BUN_BIN="$(command -v bun || find "$HOME" /._ -path '*/bin/bun' -type f 2>/dev/null | head -n 1)"
test -n "$BUN_BIN"
"$BUN_BIN" test tests/package-policy.test.ts tests/bun-latest-api.test.ts route/tests/query-navigation-history.test.ts
```

Expected: PASS.

Commit:

```bash
git add tests/package-policy.test.ts route/tests/query-navigation-history.test.ts tests/bun-latest-api.test.ts tsconfig.json bun.lock
git commit -m "test: align latest package policy baseline"
```

### Task 2: Move Test Harnesses to Svelte's Public Client API

**Files:**
- Create: `tests/helpers/svelte-client.ts`
- Modify: `tests/bun-latest-api.test.ts`
- Modify: `route/tests/route-component.test.ts`
- Modify: `ui/swiper/Swiper.test.ts`
- Modify: `ui/sort-list-box/SortListBox.test.ts`

- [ ] **Step 1: Write the failing helper smoke test**

```ts
test("test helper re-exports Svelte's public client api", async () => {
    const helper = await import("./helpers/svelte-client.ts");
    expect(typeof helper.flushSync).toBe("function");
    expect(typeof helper.svelteMount).toBe("function");
    expect(typeof helper.svelteUnmount).toBe("function");
});
```

- [ ] **Step 2: Run the targeted tests to verify the current imports are red**

Run:

```bash
BUN_BIN="$(command -v bun || find "$HOME" /._ -path '*/bin/bun' -type f 2>/dev/null | head -n 1)"
test -n "$BUN_BIN"
"$BUN_BIN" test tests/bun-latest-api.test.ts route/tests/route-component.test.ts ui/swiper/Swiper.test.ts ui/sort-list-box/SortListBox.test.ts
```

Expected: FAIL because the helper does not exist yet and the test files still import from `node_modules/svelte/src/internal/*`.

- [ ] **Step 3: Create the helper and switch the tests**

```ts
// tests/helpers/svelte-client.ts
import { flushSync, mount, unmount } from "svelte";

export { flushSync };
export const svelteMount = mount;
export const svelteUnmount = unmount;
```

```ts
// route/tests/route-component.test.ts and ui/* tests
import { flushSync, svelteMount, svelteUnmount } from "../../tests/helpers/svelte-client.ts";
```

- [ ] **Step 4: Re-run the public-client-api regression tests**

Run:

```bash
BUN_BIN="$(command -v bun || find "$HOME" /._ -path '*/bin/bun' -type f 2>/dev/null | head -n 1)"
test -n "$BUN_BIN"
"$BUN_BIN" test tests/bun-latest-api.test.ts route/tests/route-component.test.ts ui/swiper/Swiper.test.ts ui/sort-list-box/SortListBox.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit the helper migration**

```bash
git add tests/helpers/svelte-client.ts tests/bun-latest-api.test.ts route/tests/route-component.test.ts ui/swiper/Swiper.test.ts ui/sort-list-box/SortListBox.test.ts
git commit -m "test: use Svelte public client api"
```

### Task 3: Add Regression Coverage for Snippets and Event Attributes

**Files:**
- Create: `ui/tests/snippet-components.test.ts`
- Create: `ui/tests/fixtures/BlockHarness.svelte`
- Create: `ui/tests/fixtures/StringInputHarness.svelte`
- Create: `ui/tests/fixtures/RangeInputHarness.svelte`
- Create: `ui/tests/fixtures/FilledModalHarness.svelte`
- Create: `ui/tests/fixtures/SwiperHarness.svelte`
- Modify: `tests/bun-latest-api.test.ts`

- [ ] **Step 1: Write the failing source-policy and DOM regression tests**

```ts
// tests/bun-latest-api.test.ts
test("targeted public components no longer use slot markup or on: directives", () => {
    const files = [
        "ui/box/Block.svelte",
        "ui/input/StringInput.svelte",
        "ui/input/RangeInput.svelte",
        "ui/modal/FilledModal.svelte",
        "ui/swiper/Swiper.svelte",
        "ui/button/FilledButton.svelte",
        "ui/button/IconButton.svelte",
        "ui/button/TextButton.svelte",
        "ui/plyr/Plyr.svelte",
    ];

    for (const file of files) {
        const source = readRepoFile(file);
        expect(source.includes("<slot")).toBe(false);
        expect(/\son:[a-z]/.test(source)).toBe(false);
    }
});
```

```ts
// ui/tests/snippet-components.test.ts
test("Block renders snippet props into the expected regions", async () => {
    const Harness = await loadCompiledComponent("./ui/tests/fixtures/BlockHarness.svelte");
    const mounted = svelteMount(Harness, { target: document.body });
    flushSync();
    expect(document.querySelector(".header [data-testid='header-actions']")?.textContent).toBe("Actions");
    expect(document.querySelector(".body [data-testid='body']")?.textContent).toBe("Body");
    expect(document.querySelector(".footer [data-testid='footer-right']")?.textContent).toBe("More");
    svelteUnmount(mounted);
});
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run:

```bash
BUN_BIN="$(command -v bun || find "$HOME" /._ -path '*/bin/bun' -type f 2>/dev/null | head -n 1)"
test -n "$BUN_BIN"
"$BUN_BIN" test tests/bun-latest-api.test.ts ui/tests/snippet-components.test.ts
```

Expected: FAIL because the targeted components still contain `<slot` and `on:` syntax and the snippet fixtures are not implemented yet.

- [ ] **Step 3: Create the snippet fixtures with the target public API**

```svelte
<!-- ui/tests/fixtures/BlockHarness.svelte -->
<script>
    import { Block } from "../../_.ts";
</script>

<Block headerTitle="Title" footerLeft="Left">
    {#snippet headerActions()}
        <span data-testid="header-actions">Actions</span>
    {/snippet}

    {#snippet children()}
        <div data-testid="body">Body</div>
    {/snippet}

    {#snippet footerRight()}
        <span data-testid="footer-right">More</span>
    {/snippet}
</Block>
```

```svelte
<!-- ui/tests/fixtures/StringInputHarness.svelte -->
<script>
    import { StringInput } from "../../_.ts";
</script>

<StringInput label="Name" value="Ada">
    {#snippet left()}
        <span data-testid="left-addon">L</span>
    {/snippet}

    {#snippet right()}
        <span data-testid="right-addon">R</span>
    {/snippet}
</StringInput>
```

- [ ] **Step 4: Add the remaining fixture coverage**

```svelte
<!-- ui/tests/fixtures/RangeInputHarness.svelte -->
<script>
    import { RangeInput } from "../../_.ts";
</script>

<RangeInput label="Volume" value={4}>
    {#snippet left()}
        <span data-testid="left-addon">Min</span>
    {/snippet}

    {#snippet right()}
        <span data-testid="right-addon">Max</span>
    {/snippet}
</RangeInput>
```

```svelte
<!-- ui/tests/fixtures/FilledModalHarness.svelte -->
<script>
    import { FilledModal } from "../../_.ts";
</script>

<FilledModal active={true}>
    {#snippet children()}
        <div data-testid="modal-body">Modal Body</div>
    {/snippet}
</FilledModal>
```

```svelte
<!-- ui/tests/fixtures/SwiperHarness.svelte -->
<script>
    import { Swiper } from "../../_.ts";
</script>

<Swiper>
    {#snippet children()}
        <swiper-slide data-testid="slide-a">A</swiper-slide>
    {/snippet}
</Swiper>
```

- [ ] **Step 5: Commit the regression harnesses**

```bash
git add ui/tests/snippet-components.test.ts ui/tests/fixtures/BlockHarness.svelte ui/tests/fixtures/StringInputHarness.svelte ui/tests/fixtures/RangeInputHarness.svelte ui/tests/fixtures/FilledModalHarness.svelte ui/tests/fixtures/SwiperHarness.svelte tests/bun-latest-api.test.ts
git commit -m "test: add Svelte 5 snippet migration coverage"
```

### Task 4: Migrate Public UI Components and Usage Docs

**Files:**
- Modify: `ui/box/Block.svelte`
- Modify: `ui/input/StringInput.svelte`
- Modify: `ui/input/RangeInput.svelte`
- Modify: `ui/modal/FilledModal.svelte`
- Modify: `ui/swiper/Swiper.svelte`
- Modify: `ui/button/FilledButton.svelte`
- Modify: `ui/button/IconButton.svelte`
- Modify: `ui/button/TextButton.svelte`
- Modify: `ui/plyr/Plyr.svelte`
- Modify: `README.md`
- Modify: `docs/migrations/2026-04-latest-svelte5-migration.md`

- [ ] **Step 1: Implement snippet props in the composition components**

```svelte
<!-- ui/box/Block.svelte -->
<script lang="ts">
    import type { Snippet } from "svelte";

    let {
        children = undefined as Snippet | undefined,
        footerLeft = "",
        footerRight = undefined as Snippet | undefined,
        headerActions = undefined as Snippet | undefined,
        headerTitle = "",
    } = $props();
</script>

<div class="body">
    {#if children}{@render children()}{/if}
</div>
```

```svelte
<!-- ui/input/StringInput.svelte / RangeInput.svelte -->
<script lang="ts">
    import type { Snippet } from "svelte";
    let { left = undefined as Snippet | undefined, right = undefined as Snippet | undefined, ...rest } = $props();
</script>

{#if left}{@render left()}{/if}
<input ... />
{#if right}{@render right()}{/if}
```

- [ ] **Step 2: Convert event directives to event attributes**

```svelte
<button onclick={handleClick}>...</button>
<input oninput={handleInput} />
<dialog oncancel={handleCancel} onclick={handleBackdropClick}>...</dialog>
<video onclick={togglePlay}>...</video>
```

- [ ] **Step 3: Update consumer-facing docs to the new API**

```md
<StringInput>
  {#snippet left()}
    <Icon />
  {/snippet}

  {#snippet right()}
    <Button />
  {/snippet}
</StringInput>
```

```md
<FilledModal>
  {#snippet children()}
    <div>Modal Content</div>
  {/snippet}
</FilledModal>
```

- [ ] **Step 4: Run the UI regression tests and typecheck**

Run:

```bash
BUN_BIN="$(command -v bun || find "$HOME" /._ -path '*/bin/bun' -type f 2>/dev/null | head -n 1)"
test -n "$BUN_BIN"
"$BUN_BIN" test tests/bun-latest-api.test.ts ui/tests/snippet-components.test.ts ui/swiper/Swiper.test.ts ui/sort-list-box/SortListBox.test.ts route/tests/route-component.test.ts
"$BUN_BIN" run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit the public Svelte 5 migration**

```bash
git add ui/box/Block.svelte ui/input/StringInput.svelte ui/input/RangeInput.svelte ui/modal/FilledModal.svelte ui/swiper/Swiper.svelte ui/button/FilledButton.svelte ui/button/IconButton.svelte ui/button/TextButton.svelte ui/plyr/Plyr.svelte README.md docs/migrations/2026-04-latest-svelte5-migration.md
git commit -m "feat: migrate public components to Svelte 5 usage"
```

### Task 5: Modernize Builder Bun Typing, Refresh Builder Dependencies, and Document Runtime Boundaries

**Files:**
- Modify: `tests/bun-latest-api.test.ts`
- Modify: `builder/build.ts`
- Modify: `builder/dev.ts`
- Modify: `builder/finalize-css.ts`
- Modify: `builder/finalize-js.ts`
- Modify: `builder/tests/finalize-js.test.ts`
- Modify: `builder/tests/svelte-runtime-alias.test.ts`
- Modify: `builder/src/types.d.ts`
- Modify: `builder/README.md`
- Modify: `builder/bun.lock`

- [ ] **Step 1: Write the failing builder-boundary documentation test**

```ts
test("builder README documents the intentional Svelte internal runtime boundary", () => {
    const readme = readRepoFile("builder/README.md");
    expect(readme.includes("svelte/internal/client")).toBe(true);
    expect(readme.includes("upgrade-sensitive boundary")).toBe(true);
    expect(readme.includes("bun run build")).toBe(true);
});
```

- [ ] **Step 2: Run the focused builder tests to confirm the red bar**

Run:

```bash
BUN_BIN="$(command -v bun || find "$HOME" /._ -path '*/bin/bun' -type f 2>/dev/null | head -n 1)"
test -n "$BUN_BIN"
"$BUN_BIN" test tests/bun-latest-api.test.ts builder/tests/finalize-js.test.ts builder/tests/svelte-runtime-alias.test.ts builder/tests/load-config.test.ts builder/tests/compiler-import.test.ts builder/tests/dev-watch-events.test.ts builder/tests/assets.test.ts
```

Expected: FAIL because `builder/*` still uses legacy `Bun.*` namespace types and the README does not yet document the approved internal-coupling boundary.

- [ ] **Step 3: Replace legacy Bun namespace types with module type imports**

```ts
import type { BuildArtifact, BuildConfig, BunPlugin, Server } from "bun";

type BunServeOptions = Parameters<typeof Bun.serve>[0];
type DevErrorLike = Parameters<NonNullable<BunServeOptions["error"]>>[0];

const createSvelteRuntimeAliasPlugin = (rootDir: string): BunPlugin => ({ ... });
const createServerHandle = (server: Server<undefined>): DevServerHandle => ({ ... });
const resolveSourcemapMode = (sourcemap: boolean | undefined): BuildConfig["sourcemap"] =>
    sourcemap ? "inline" : "none";
```

```ts
// builder/tests/finalize-js.test.ts
import type { BuildArtifact } from "bun";

type FakeOutput = BuildArtifact & {
    kind: "chunk" | "entry-point" | "asset";
    path: string;
    text: () => Promise<string>;
};
```

- [ ] **Step 4: Refresh the builder lockfile and document the retained runtime boundary**

Run:

```bash
cd builder
BUN_BIN="$(command -v bun || find "$HOME" /._ -path '*/bin/bun' -type f 2>/dev/null | head -n 1)"
test -n "$BUN_BIN"
"$BUN_BIN" install
```

Expected: exits `0` and updates `builder/bun.lock` if `esbuild` or transitive dependencies move.

Add a dedicated `builder/README.md` section that says:

```md
## Upgrade-sensitive boundary

`svelte-builder` still intentionally depends on `svelte/internal/client` for HMR and on resolved browser runtime entry files under the installed `svelte` package for dev/runtime aliasing.

This is an intentional compatibility boundary, not a general public-API guarantee. After every Svelte upgrade, re-run:

    bun test
    bun run typecheck
    cd builder && bun run build
```

- [ ] **Step 5: Re-run builder verification and commit**

Run:

```bash
BUN_BIN="$(command -v bun || find "$HOME" /._ -path '*/bin/bun' -type f 2>/dev/null | head -n 1)"
test -n "$BUN_BIN"
"$BUN_BIN" test
"$BUN_BIN" run typecheck
cd builder && "$BUN_BIN" run build
```

Expected: PASS.

Commit:

```bash
git add tests/bun-latest-api.test.ts builder/build.ts builder/dev.ts builder/finalize-css.ts builder/finalize-js.ts builder/tests/finalize-js.test.ts builder/tests/svelte-runtime-alias.test.ts builder/src/types.d.ts builder/README.md builder/bun.lock
git commit -m "chore: refresh builder latest compatibility"
```
