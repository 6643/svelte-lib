# UI Theme Functions Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove `useTheme`, add `setLightTheme()` and `setDarkTheme()` to `svelte-lib/ui`, and switch theme control to direct CSS variable writes on the root element.

**Architecture:** Keep theme behavior minimal and side-effect only. A new `src/ui/theme.ts` module will own the fixed light/dark variable maps and write them to `document.documentElement.style`. `src/use/useTheme.ts` and its export surface will be removed entirely so the public theme API lives only under `ui`.

**Tech Stack:** Bun, TypeScript, Svelte 5, Bun test, svelte-check

---

### Task 1: Lock The New UI Theme API With Failing Tests

**Files:**
- Create: `src/ui/tests/theme.test.ts`
- Read: `src/ui/_.ts`
- Read: `src/use/useTheme.test.ts`

- [ ] **Step 1: Write the failing UI theme tests**

Create `src/ui/tests/theme.test.ts` with coverage for:

```ts
import { afterEach, expect, test } from "bun:test";

const loadThemeModule = async (): Promise<typeof import("../theme.ts")> =>
    import(new URL(`../theme.ts?test=${Date.now()}-${Math.random()}`, import.meta.url).href) as Promise<
        typeof import("../theme.ts")
    >;

test("setLightTheme writes the light token set to document.documentElement.style", async () => {
    // install a document stub with documentElement.style.setProperty
    // call setLightTheme()
    // assert the expected variables were written
});

test("setDarkTheme overwrites the same variables with dark values", async () => {
    // install a document stub
    // call setLightTheme(), then setDarkTheme()
    // assert the same keys now hold dark values
});

test("theme functions no-op outside the browser", async () => {
    // clear global document
    // assert neither function throws
});
```

- [ ] **Step 2: Run the new test file and verify it fails**

Run:

```bash
bun test --conditions=browser src/ui/tests/theme.test.ts
```

Expected:

- FAIL because `src/ui/theme.ts` does not exist yet

- [ ] **Step 3: Commit the failing-test scaffold only after confirming the red state**

```bash
git add src/ui/tests/theme.test.ts
git commit -m "test: lock ui theme function api"
```

### Task 2: Implement `src/ui/theme.ts`

**Files:**
- Create: `src/ui/theme.ts`
- Test: `src/ui/tests/theme.test.ts`

- [ ] **Step 1: Create the minimal theme token module**

Implement `src/ui/theme.ts` with:

```ts
const LIGHT_THEME_VARS = {
    "--theme-color": "...",
    "--sf-color": "...",
    "--sb-color": "...",
    "--pf-color": "...",
} as const;

const DARK_THEME_VARS = {
    "--theme-color": "...",
    "--sf-color": "...",
    "--sb-color": "...",
    "--pf-color": "...",
} as const;

const applyThemeVariables = (values: Record<string, string>): void => {
    if (typeof document === "undefined") return;
    const style = document.documentElement?.style;
    if (!style) return;

    Object.entries(values).forEach(([name, value]) => {
        style.setProperty(name, value);
    });
};

export const setLightTheme = (): void => {
    applyThemeVariables(LIGHT_THEME_VARS);
};

export const setDarkTheme = (): void => {
    applyThemeVariables(DARK_THEME_VARS);
};
```

Use fixed values only. No persistence, no state, no media-query detection.

- [ ] **Step 2: Run the new test file and verify it passes**

Run:

```bash
bun test --conditions=browser src/ui/tests/theme.test.ts
```

Expected:

- PASS

- [ ] **Step 3: Commit the implementation**

```bash
git add src/ui/theme.ts src/ui/tests/theme.test.ts
git commit -m "feat: add ui theme setter functions"
```

### Task 3: Move The Public Theme API From `use` To `ui`

**Files:**
- Modify: `src/ui/_.ts`
- Modify: `src/use/_.ts`
- Delete: `src/use/useTheme.ts`
- Delete: `src/use/useTheme.test.ts`

- [ ] **Step 1: Export the new theme functions from `ui`**

In `src/ui/_.ts`, add:

```ts
export * from "./theme.ts";
```

Keep the existing Svelte component exports unchanged.

- [ ] **Step 2: Remove the old `useTheme` export**

In `src/use/_.ts`, delete:

```ts
export * from "./useTheme.ts";
```

- [ ] **Step 3: Delete the old `useTheme` implementation and test**

Remove:

- `src/use/useTheme.ts`
- `src/use/useTheme.test.ts`

- [ ] **Step 4: Run focused export and type checks**

Run:

```bash
bun test tests/package-exports.test.ts tests/bun-latest-api.test.ts
bun run typecheck
```

Expected:

- `package-exports` still passes
- `typecheck` may still be red if docs/policy tests mention `useTheme`

- [ ] **Step 5: Commit the API move**

```bash
git add src/ui/_.ts src/use/_.ts src/use/useTheme.ts src/use/useTheme.test.ts
git commit -m "refactor: move theme api from use to ui"
```

### Task 4: Update Repository Policy Tests

**Files:**
- Modify: `tests/bun-latest-api.test.ts`
- Modify if needed: `tests/package-policy.test.ts`

- [ ] **Step 1: Add assertions for the new theme API location**

Update policy tests so they assert:

- `src/use/useTheme.ts` does not exist
- `src/use/useTheme.test.ts` does not exist
- `src/ui/theme.ts` exists
- `src/ui/_.ts` exports the theme functions

If any existing assertions mention `useTheme`, replace them with the new contract.

- [ ] **Step 2: Run policy tests and verify they pass**

Run:

```bash
bun test tests/bun-latest-api.test.ts tests/package-policy.test.ts
```

Expected:

- PASS

- [ ] **Step 3: Commit the policy updates**

```bash
git add tests/bun-latest-api.test.ts tests/package-policy.test.ts
git commit -m "test: update theme api policy coverage"
```

### Task 5: Update User-Facing Documentation

**Files:**
- Modify: `README.md`
- Modify if needed: `src/ui/README.md` only if a theme section exists there
- Modify if needed: `docs/migrations/2026-04-latest-svelte5-migration.md`

- [ ] **Step 1: Replace old theme guidance with the new UI functions**

Document the new usage pattern, for example:

```ts
import { setDarkTheme, setLightTheme } from "svelte-lib/ui";

setDarkTheme();
setLightTheme();
```

Explicitly state:

- theme switching now lives in `svelte-lib/ui`
- it is implemented via CSS variables
- no persistence is built in

- [ ] **Step 2: If migration docs mention `useTheme`, mark it as removed**

Add a concise breaking-change note if the migration guide already has a theme-related section or API removal section.

- [ ] **Step 3: Run doc/policy verification**

Run:

```bash
bun test tests/bun-latest-api.test.ts
```

Expected:

- PASS

- [ ] **Step 4: Commit the doc updates**

```bash
git add README.md docs/migrations/2026-04-latest-svelte5-migration.md tests/bun-latest-api.test.ts
git commit -m "docs: describe ui theme functions"
```

### Task 6: Final Verification

**Files:**
- Verify only: `src/ui/theme.ts`
- Verify only: `src/ui/_.ts`
- Verify only: `src/use/_.ts`
- Verify only: `tests/*`

- [ ] **Step 1: Run the complete test suite**

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

- [ ] **Step 3: Inspect the final theme API surface**

Run:

```bash
rg -n "useTheme|setLightTheme|setDarkTheme" src README.md tests
```

Expected:

- `useTheme` no longer appears as a live exported API
- `setLightTheme` / `setDarkTheme` appear in `src/ui` and docs/tests only

- [ ] **Step 4: Create the final integration commit**

```bash
git add src README.md tests docs/migrations/2026-04-latest-svelte5-migration.md
git commit -m "refactor: replace useTheme with ui theme setters"
```

## 回滚

若实现后发现主题 token 设计不合适，按以下顺序回滚：

1. 恢复 `src/use/useTheme.ts`
2. 恢复 `src/use/useTheme.test.ts`
3. 在 `src/use/_.ts` 恢复导出
4. 删除 `src/ui/theme.ts`
5. 在 `src/ui/_.ts` 移除 `setLightTheme` / `setDarkTheme`
6. 回滚 README 与迁移文档中的新主题说明

## 完成标志

- `useTheme` 已从仓库中移除
- `svelte-lib/ui` 公开 `setLightTheme()` / `setDarkTheme()`
- 主题切换只通过 CSS 变量完成
- 不存在持久化逻辑
- `bun run test` 与 `bun run typecheck` 全绿
