# svelte-builder Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重写 `src/builder/` 为更小、更直接的实现，收口导出，简化 build/dev/config 流程，并补齐关键安全与错误路径覆盖。

**Architecture:** 以 `config.ts` 作为配置边界，`build.ts` 作为生产构建流水线，`dev.ts` 作为开发服务器入口，`assets.ts` 作为资产边界，`utils.ts` 只保留基础结果与路径工具。内部实现优先函数化和守卫式返回，公开面尽量只保留真正需要的入口。

**Tech Stack:** TypeScript, Bun, Svelte 5 compiler, bun:test

## Global Constraints

- 收敛对外导出和少量配置语义
- 不保留历史兼容垫片和中间 helper
- 配置文件按 TypeScript 语法加载
- 只接受结构化默认导出对象
- 旧配置格式不再保留
- 不再容忍历史字段别名
- `buildSvelte()` 改成分段流水线，但保持在 `build.ts` 内部，不继续拆成零碎模块
- `dev.ts` 只保留服务启动、请求分发、SSE / reload 连接、配置重载入口
- 必须覆盖路径穿越、符号链接逃逸、TOCTOU 风险、临时文件泄露、输出目录和源码目录重叠、本地源码导入越界
- 每个阶段都要能单独验证和回退

---

### Task 1: 收口公共 API 与导出面

**Files:**
- Modify: `src/builder/_.ts`
- Modify: `src/builder/build.ts`
- Modify: `src/builder/dev.ts`
- Modify: `src/builder/tests/cli-entry.test.ts`
- Modify: `src/builder/tests/build-plugins.test.ts`

**Interfaces:**
- Consumes: existing `buildSvelte`, `runConfiguredBuild`, `runConfiguredDevServer`, `defineSvelteConfig`, `loadSvelteConfig`
- Produces: a reduced public surface exported from `src/builder/_.ts`

- [ ] **Step 1: Write the failing export-surface test**

```ts
import { expect, test } from "bun:test";
import * as builder from "../_";

test("builder public surface is intentionally small", () => {
    expect("validateMountId" in builder).toBe(false);
    expect("validateAppComponent" in builder).toBe(false);
    expect("resolveAppSourceRoot" in builder).toBe(false);
    expect("validateResolvedAppComponentPath" in builder).toBe(false);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test src/builder/tests/cli-entry.test.ts src/builder/tests/export-surface.test.ts`
Expected: fail until `_.ts` stops exporting internal helpers.

- [ ] **Step 3: Remove internal helper exports from `src/builder/_.ts`**

```ts
export { buildSvelte, buildProduction, defineSvelteConfig, loadSvelteConfig, runConfiguredBuild } from "./build";
export type { BuildArtifacts, BuildSvelteOptions, Result } from "./build";
export type { DevServerHandle } from "./dev";
export { runConfiguredDevServer } from "./dev";
export { formatBuildReport } from "./report";
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test src/builder/tests/cli-entry.test.ts`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/builder/_.ts src/builder/build.ts src/builder/dev.ts src/builder/tests/cli-entry.test.ts src/builder/tests/build-plugins.test.ts
git commit -m "refactor: narrow builder public surface"
```

### Task 2: Rewrite configuration loading and validation as one boundary

**Files:**
- Modify: `src/builder/config.ts`
- Modify: `src/builder/tests/load-config.test.ts`
- Modify: `src/builder/tests/cli-entry.test.ts`

**Interfaces:**
- Consumes: `ok`, `err`, `getErrorMessage`, `isPathWithinRoot`, `Result`
- Produces: `loadSvelteConfig`, `defineSvelteConfig`, `validateMountId`, `validateAppComponent`, `resolveAppSourceRoot`, `validateResolvedAppComponentPath`, `CONFIG_FILE_NAME`

- [ ] **Step 1: Write failing tests for TS config syntax and strict field handling**

```ts
test("loadSvelteConfig accepts TypeScript syntax in builder.ts", async () => {
    const rootDir = await createTempProject(`
        interface BuilderConfig {
            appTitle: string;
            mountId?: string;
        }

        const config: BuilderConfig = {
            appTitle: "Typed Builder",
            mountId: "app:root"
        };

        export default config;
    `);

    const result = await loadSvelteConfig(rootDir);
    expect(result.ok).toBe(true);
});
```

- [ ] **Step 2: Run the test to verify it fails on the old loader**

Run: `bun test src/builder/tests/load-config.test.ts`
Expected: fail if `builder.ts` is imported as raw `.mjs` without TS transpile.

- [ ] **Step 3: Keep config loading as a TS transpile + isolated temp module import**

```ts
const source = await Bun.file(configPath).text();
await writeFile(tempConfigPath, configTranspiler.transformSync(source), "utf8");
const loaded = await import(pathToFileURL(tempConfigPath).href);
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test src/builder/tests/load-config.test.ts`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/builder/config.ts src/builder/tests/load-config.test.ts src/builder/tests/cli-entry.test.ts
git commit -m "refactor: harden builder config loading"
```

### Task 3: Rebuild `buildSvelte()` as a linear pipeline

**Files:**
- Modify: `src/builder/build.ts`
- Modify: `src/builder/tests/build-lazy-chunks.test.ts`
- Modify: `src/builder/tests/assets.test.ts`
- Add: `src/builder/tests/build-errors.test.ts`

**Interfaces:**
- Consumes: `resolveBuildContext`, `validateOutDir`, `createHtmlShell`, `copyConfiguredAssets`, `runConfiguredBuild`
- Produces: a staged `buildSvelte()` with explicit step functions

- [ ] **Step 1: Write failing tests for build error paths and temporary cleanup**

```ts
test("buildSvelte rejects outDir that overlaps src tree", async () => {
    const result = await buildSvelte({
        appComponent: "src/App.svelte",
        outDir: "src/dist",
        rootDir,
    });

    expect(result.ok).toBe(false);
});

test("buildSvelte cleans temporary directories after a failed build", async () => {
    const result = await buildSvelte({
        appComponent: "src/Missing.svelte",
        outDir: "dist",
        rootDir,
    });

    expect(result.ok).toBe(false);
});
```

- [ ] **Step 2: Run the build tests to confirm the missing coverage**

Run: `bun test src/builder/tests/build-lazy-chunks.test.ts src/builder/tests/assets.test.ts src/builder/tests/build-errors.test.ts`
Expected: at least the new error-path test fails before implementation.

- [ ] **Step 3: Split `buildSvelte()` into named stages**

```ts
const ctx = await resolveBuildContext(rootDir, options);
if (!ctx.ok) return ctx;
const dirs = await prepareBuildDirectories(ctx.value);
if (!dirs.ok) return dirs;
const built = await runBunBuild(ctx.value, dirs.value);
if (!built.ok) return built;
```

- [ ] **Step 4: Run the build test set to verify pass**

Run: `bun test src/builder/tests/build-lazy-chunks.test.ts src/builder/tests/assets.test.ts src/builder/tests/build-errors.test.ts`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/builder/build.ts src/builder/tests/build-lazy-chunks.test.ts src/builder/tests/assets.test.ts src/builder/tests/build-errors.test.ts
git commit -m "refactor: simplify builder pipeline"
```

### Task 4: Tighten dev server request routing and module loading

**Files:**
- Modify: `src/builder/dev.ts`
- Modify: `src/builder/tests/dev-watch-events.test.ts`
- Modify: `src/builder/tests/dev-proxy.test.ts`
- Add: `src/builder/tests/dev-router.test.ts`
- Add: `src/builder/tests/dev-errors.test.ts`

**Interfaces:**
- Consumes: `classifyDevWatchTarget`, `resolveDevRequestPath`, `loadDevModule`, `createDevReloadHub`
- Produces: a slimmer `runConfiguredDevServer()` with separated request branches

- [ ] **Step 1: Write failing tests for routing and watch classification**

```ts
test("builder dev keeps config reload distinct from module reload", () => {
    const config = classifyDevWatchTarget({
        eventPath: "/app/builder.ts",
        fileStatus: "missing",
        filename: "builder.ts",
        watchDir: "/app",
    });

    expect(config).toEqual({ kind: "config" });
});

test("builder dev routes source requests by extension", () => {
    expect(isSupportedTypeScriptSourceModule("src/App.ts")).toBe(true);
    expect(isSupportedJavaScriptSourceModule("src/App.js")).toBe(true);
    expect(isSupportedSvelteSourceModule("src/App.svelte")).toBe(true);
});
```

- [ ] **Step 2: Run the dev tests to verify current branch handling**

Run: `bun test src/builder/tests/dev-watch-events.test.ts src/builder/tests/dev-proxy.test.ts src/builder/tests/dev-router.test.ts src/builder/tests/dev-errors.test.ts`
Expected: fail where routing or export surface is still too loose.

- [ ] **Step 3: Collapse the repeated `.ts` / `.js` / `.svelte` source handlers into one source loader path**

```ts
const handlers = [
    [isSupportedTypeScriptSourceModule, loadDevModule],
    [isSupportedJavaScriptSourceModule, loadDevModule],
    [isSupportedSvelteSourceModule, loadDevModule],
];
```

- [ ] **Step 4: Run the dev tests to verify pass**

Run: `bun test src/builder/tests/dev-watch-events.test.ts src/builder/tests/dev-proxy.test.ts src/builder/tests/dev-router.test.ts src/builder/tests/dev-errors.test.ts`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/builder/dev.ts src/builder/tests/dev-watch-events.test.ts src/builder/tests/dev-proxy.test.ts src/builder/tests/dev-router.test.ts src/builder/tests/dev-errors.test.ts
git commit -m "refactor: simplify builder dev server"
```

### Task 5: Collapse shared utilities and prune dead helpers

**Files:**
- Modify: `src/builder/utils.ts`
- Modify: `src/builder/assets.ts`
- Modify: `src/builder/report.ts`
- Modify: `src/builder/tests/import-utils.test.ts`
- Modify: `src/builder/tests/source-modules.test.ts`

**Interfaces:**
- Consumes: `Result`, `ok`, `err`, `isPathWithinRoot`, `normalizeModulePath`
- Produces: a smaller utility surface with fewer duplicate helpers

- [ ] **Step 1: Write failing tests for the helpers that should remain exported**

```ts
test("normalizeModulePath preserves relative leading dot", () => {
    expect(normalizeModulePath("foo/bar")).toBe("foo/bar");
});
```

- [ ] **Step 2: Run the utility tests**

Run: `bun test src/builder/tests/import-utils.test.ts src/builder/tests/source-modules.test.ts`
Expected: fail if helper behavior changes unexpectedly.

- [ ] **Step 3: Remove duplicate helper implementations and keep only one source of truth**

```ts
export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const err = (error: string): Result<never> => ({ ok: false, error });
```

- [ ] **Step 4: Run the utility tests again**

Run: `bun test src/builder/tests/import-utils.test.ts src/builder/tests/source-modules.test.ts`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add src/builder/utils.ts src/builder/assets.ts src/builder/report.ts src/builder/tests/import-utils.test.ts src/builder/tests/source-modules.test.ts
git commit -m "refactor: prune builder utility surface"
```

### Task 6: Close the rewrite with full regression and API audit

**Files:**
- Modify: `src/builder/tests/*.test.ts`
- Modify: `src/builder/README.md` if exported behavior changes

**Interfaces:**
- Consumes: rewritten build/dev/config/util modules
- Produces: validated regression coverage and updated docs

- [ ] **Step 1: Run the full builder test suite**

Run: `bun test src/builder/tests`
Expected: all pass.

- [ ] **Step 2: Run typecheck**

Run: `bun run typecheck`
Expected: no errors.

- [ ] **Step 3: Audit the public export surface**

```ts
import * as builder from "../src/builder/_";

expect(Object.keys(builder).sort()).toEqual([
    "buildProduction",
    "buildSvelte",
    "defineSvelteConfig",
    "formatBuildReport",
    "loadSvelteConfig",
    "runConfiguredBuild",
    "runConfiguredDevServer",
]);
```

- [ ] **Step 4: Update README if exported behavior changed**

Keep the docs aligned with the final public surface and config semantics.

- [ ] **Step 5: Commit**

```bash
git add src/builder README.md docs/superpowers/plans/2026-06-29-builder-rewrite.md
git commit -m "refactor: complete builder rewrite"
```
