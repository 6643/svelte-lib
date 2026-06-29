# svelte-builder 重构实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 对 `src/builder/` 进行 5 步渐进重构：提取共享基础设施、拆分大文件、管道化单体函数、补测试覆盖、清理遗留重复。

**Architecture:** 基于 Bun + Svelte 5 的构建器和开发服务器。保持所有公共 API 和 Svelte 升级敏感边界不变。每步独立提交可回退。

**Tech Stack:** TypeScript, Bun, Svelte 5 compiler

## 全局约束

- 不改变 `_.ts` 的公共导出
- 不改变配置格式 `builder.ts` 字段名与默认值
- 不改变 `Result<T>` 模式风格（仅统一定义位置）
- 不改变错误信息文案
- 不改变 HTML shell 结构
- 不改变 Svelte 升级敏感边界（HMR 客户端引用 `svelte/internal/client`、dev/runtime alias）
- 每步必须 `bun test` 和 `bun run typecheck` 通过

---

### Task 1: 创建 `utils.ts` 并提取所有共享辅助函数

**Files:**
- Create: `src/builder/utils.ts`
- Modify: `src/builder/build.ts`, `src/builder/assets.ts`, `src/builder/build-validate.ts`, `src/builder/build-publish.ts`, `src/builder/build-config.ts`, `src/builder/build-plugins.ts`, `src/builder/dev.ts`, `src/builder/dev-imports.ts`, `src/builder/dev-reload.ts`, `src/builder/bootstrap.ts`, `src/builder/dev-config.ts`

**Interfaces:**
- Produces: `src/builder/utils.ts` 导出 `Result<T>`, `ok()`, `fail()`, `getErrorMessage()`, `getErrorCode()`, `isPathWithinRoot()`, `normalizeModulePath()`, `resolveConfiguredPath()`

- [ ] **Step 1: 创建 `src/builder/utils.ts`**

```typescript
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });

export const fail = (error: string): Result<never> => ({ ok: false, error });

export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

export const getErrorCode = (error: unknown): string | undefined =>
  error instanceof Error && "code" in error && typeof error.code === "string"
    ? error.code
    : undefined;

export const isPathWithinRoot = (rootPath: string, candidatePath: string): boolean => {
  const relativePath = relative(rootPath, candidatePath);
  return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
};

export const normalizeModulePath = (value: string): string => value.replace(/\\/g, "/");

export const resolveConfiguredPath = (rootDir: string, value: string | undefined, fallback: string): string => {
  const target = value ?? fallback;
  return isAbsolute(target) ? target : join(rootDir, target);
};
```

- [ ] **Step 2: 修改 `build.ts` — 使用 `utils.ts` 替换重复定义**

删除：
- `Result<T>` 类型定义（第 44 行）
- `ok` / `fail` 函数（第 86-88 行）
- `getErrorMessage`（第 90-96 行）
- `getErrorCode`（第 98-99 行）
- `isPathWithinRoot`（第 101-105 行）
- `resolveConfiguredPath`（第 107-110 行）

添加导入：
```typescript
import { ok, fail, getErrorMessage, getErrorCode, isPathWithinRoot, resolveConfiguredPath, type Result } from "./utils";
```

保留 `build.ts` 中的 `export type { Result } from "./build"` 在 `_.ts` 中使用 — 同时从 `utils.ts` 导出 `Result`，其他文件改从 `utils` 导入。

同时删除 `dev.ts` 中第 71-72 行的重复 `escapeHtml`，改为从 `import-utils.ts` 导入。

- [ ] **Step 3: 修改 `assets.ts` — 使用 `utils.ts`**

删除 `Result<T>`（第 4 行）、`ok`/`fail`（第 10-12 行）、`getErrorCode`（第 14-17 行）、`isPathWithinRoot`（第 19-23 行）。

添加导入：
```typescript
import { ok, fail, getErrorCode, isPathWithinRoot, type Result } from "./utils";
```

- [ ] **Step 4: 修改 `build-validate.ts` — 使用 `utils.ts`**

删除 `Result<T>`（第 22 行）、`ok`/`fail`（第 24-25 行）、`getErrorMessage`（第 27-33 行）、`isPathWithinRoot`（第 35-38 行）。

添加导入：
```typescript
import { ok, fail, getErrorMessage, isPathWithinRoot, type Result } from "./utils";
```

- [ ] **Step 5: 修改 `build-publish.ts` — 使用 `utils.ts`**

删除 `Result<T>`（第 6 行）、`ok`/`fail`（第 13-14 行）、`getErrorMessage`（第 16-22 行）、`getErrorCode`（第 24-25 行）、`isPathWithinRoot`（第 30-34 行）。

添加导入：
```typescript
import { ok, fail, getErrorMessage, getErrorCode, isPathWithinRoot, type Result } from "./utils";
```

- [ ] **Step 6: 修改 `build-config.ts` — 使用 `utils.ts`**

删除 `Result<T>`（第 7 行）、`ok`/`fail`（第 37-38 行）、`getErrorMessage`（第 40-46 行）。

添加导入：
```typescript
import { ok, fail, getErrorMessage, type Result } from "./utils";
```

- [ ] **Step 7: 修改 `build-plugins.ts` — 使用 `utils.ts`**

删除 `getErrorMessage`（第 7-10 行）、`ok`/`fail`（第 12-13 行）。不再从 `./build` 导入 `Result`。

添加导入：
```typescript
import { ok, fail, getErrorMessage, type Result } from "./utils";
```

- [ ] **Step 8: 修改 `dev.ts` — 使用 `utils.ts`**

删除 `ok`/`fail`（第 53-55 行）、`getErrorMessage`（第 60-66 行）、`getErrorCode`（第 68-69 行）、`escapeHtml`（第 71-72 行）、`normalizeModulePath`（第 80 行）。`Result` 类型从 `./build` 导入（保留不变）。

添加导入：
```typescript
import { ok, fail, getErrorMessage, getErrorCode, normalizeModulePath } from "./utils";
import { escapeHtml } from "./import-utils";
```

- [ ] **Step 9: 修改 `dev-imports.ts` — 使用 `utils.ts`**

删除 `Result<T>`（第 4 行）、`ok`/`fail`（第 14-15 行）、`getErrorMessage`（第 17-23 行）、`normalizeModulePath`（第 25 行）。

添加导入：
```typescript
import { ok, fail, getErrorMessage, normalizeModulePath, type Result } from "./utils";
```

- [ ] **Step 10: 修改 `dev-reload.ts` — 使用 `utils.ts`**

删除 `getErrorMessage`（第 28-34 行）。

添加导入：
```typescript
import { getErrorMessage } from "./utils";
```

- [ ] **Step 11: 修改 `bootstrap.ts` — 使用 `utils.ts`**

删除 `normalizeImportPath`（第 3 行）— 改为使用 `normalizeModulePath`。`resolveConfiguredPath` 移到 `utils.ts`，这里导入。

添加导入：
```typescript
import { normalizeModulePath } from "./utils";
// resolveConfiguredPath 已在 utils.ts 中，这里继续导出供 dev-config.ts 使用
export { resolveConfiguredPath } from "./utils";
```

同时将 `createImportPath` 函数中的 `normalizeImportPath` 替换为 `normalizeModulePath`。

- [ ] **Step 12: 修改 `dev-config.ts` — 使用 `utils.ts`**

删除 `ok`/`fail`（第 28-29 行）、`normalizeModulePath`（第 31 行）。`resolveConfiguredPath` 从 `./bootstrap` 导入改为从 `./utils` 导入。

添加导入：
```typescript
import { ok, fail, normalizeModulePath } from "./utils";
import { resolveConfiguredPath } from "./utils";
```

- [ ] **Step 13: 运行测试验证**

```bash
bun test && bun run typecheck
```
Expected: 全部通过。

- [ ] **Step 14: 提交**

```bash
git add src/builder/utils.ts src/builder/build.ts src/builder/assets.ts src/builder/build-validate.ts src/builder/build-publish.ts src/builder/build-config.ts src/builder/build-plugins.ts src/builder/dev.ts src/builder/dev-imports.ts src/builder/dev-reload.ts src/builder/bootstrap.ts src/builder/dev-config.ts
git commit -m "refactor(builder): extract shared utilities to utils.ts

- Extract Result<T>, ok, fail, getErrorMessage, getErrorCode,
  isPathWithinRoot, normalizeModulePath, resolveConfiguredPath
- Remove duplicate escapeHtml from dev.ts, use import-utils version
- 9 files consume from utils.ts instead of redefining helpers

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: 修改 `finalize-css.ts` 和 `finalize-js.ts` 的 Result 引用

**Files:**
- Modify: `src/builder/finalize-css.ts`, `src/builder/finalize-js.ts`

**Note:** `finalize-css.ts` 有自己的 `Result`（第 6 行）且只在该文件内使用；`finalize-js.ts` 从 `./build` 导入 `Result`。两个文件都保持原位引用不变 — `finalize-css.ts` 的 `Result` 和 `formatBuildLogs`/`getBuildErrorMessage` 延后到 Task 5 清理。

- [ ] **Step 1: 确认不需要改动**

运行测试确认：
```bash
bun test && bun run typecheck
```
Expected: 全部通过。

---

### Task 3: 拆分 `dev.ts` — 提取编译模块 `dev-compile.ts`

**Files:**
- Create: `src/builder/dev-compile.ts`
- Modify: `src/builder/dev.ts`

**Interfaces:**
- Consumes: `Result` from `./utils`, source-modules helpers from `./source-modules`
- Produces: `DevCompileCache`, `DevCompileCacheEntry`, `createDevCompileCache()`, `createDevCompileCacheKey()`, `loadDevModule()`, `loadUncachedDevModule()`, `compileSvelteForDev()`, `transpileTypeScriptForDev()`, `compileChangedDevAsset()`, `createCssInjection()`, `loadRequiredText()`, `createDevModuleErrorResponse()`, `logRecompiledAsset()`, `createRecompiledAssetReport()`

- [ ] **Step 1: 创建 `src/builder/dev-compile.ts`**

从 `dev.ts` 中提取以下函数和类型到新文件：

```typescript
import { gzipSync } from "node:zlib";
import { statSync } from "node:fs";
import { join } from "node:path";
import { compile } from "svelte/compiler";
import { ok, fail, getErrorMessage, normalizeModulePath, type Result } from "./utils";
import { rewriteBareImportsForDev } from "./dev-imports";
import { formatAssetReport } from "./report";
import { validateLocalSourceImportGraph } from "./build";
import {
  isSupportedJavaScriptSourceModule,
  isSupportedLocalSourceModule,
  isSupportedSvelteSourceModule,
  isSupportedTypeScriptSourceModule,
} from "./source-modules";

// ---- 类型 ----

type DevCompileCacheEntry = {
  contents: string;
  mtimeMs: number;
};

export type DevCompileCache = {
  invalidate: (cacheKey: string) => void;
  read: (cacheKey: string, mtimeMs: number) => string | undefined;
  write: (cacheKey: string, mtimeMs: number, contents: string) => void;
};

// ---- 日志 ----

const createRecompiledAssetReport = (modulePath: string, contents: string): string =>
  formatAssetReport(
    "Recompiled assets",
    [
      {
        file: modulePath,
        gzip: gzipSync(contents).byteLength,
        size: Buffer.byteLength(contents),
        time: new Date().toISOString().replace("T", " ").slice(0, 19),
      },
    ],
    { includeTime: true },
  );

const logRecompiledAsset = (modulePath: string, contents: string): void => {
  console.log(createRecompiledAssetReport(modulePath, contents));
};

// ---- 缓存 ----

export const createDevCompileCache = (): DevCompileCache => {
  const entries = new Map<string, DevCompileCacheEntry>();

  return {
    invalidate: (cacheKey) => {
      entries.delete(cacheKey);
    },
    read: (cacheKey, mtimeMs) => {
      const entry = entries.get(cacheKey);
      if (entry === undefined || entry.mtimeMs !== mtimeMs) {
        return undefined;
      }
      return entry.contents;
    },
    write: (cacheKey, mtimeMs, contents) => {
      entries.set(cacheKey, { contents, mtimeMs });
    },
  };
};

export const createDevCompileCacheKey = (rootDir: string, modulePath: string): string =>
  normalizeModulePath(join(rootDir, modulePath));

// ---- 文件读取 ----

export const loadRequiredText = async (path: string): Promise<Result<string>> => {
  const file = Bun.file(path);
  const exists = await file.exists();
  if (!exists) {
    return fail(`Missing file: ${path}`);
  }

  return file.text().then(
    (value) => ok(value),
    (error) => fail(`Failed to read ${path}: ${getErrorMessage(error)}`),
  );
};

// ---- CSS 注入 ----

export const createCssInjection = (modulePath: string, cssCode: string | undefined): string => {
  if (!cssCode) {
    return "";
  }

  return [
    "(() => {",
    `    const id = ${JSON.stringify(modulePath)};`,
    `    if (!document.querySelector(\`style[data-svelte-id="\${id}"]\`)) {`,
    `        const style = document.createElement("style");`,
    `        style.setAttribute("data-svelte-id", id);`,
    `        style.textContent = ${JSON.stringify(cssCode)};`,
    `        document.head.appendChild(style);`,
    "    }",
    "})();",
  ].join("\n");
};

// ---- 编译 ----

const tsTranspiler = new Bun.Transpiler({ loader: "ts" });

export const compileSvelteForDev = async (rootDir: string, modulePath: string, shouldLog = false): Promise<Result<string>> => {
  const source = await loadRequiredText(join(rootDir, modulePath));
  if (!source.ok) {
    return source;
  }

  return Promise.resolve()
    .then(() =>
      compile(source.value, {
        dev: true,
        filename: modulePath,
        generate: "client",
      }),
    )
    .then(
      ({ css, js }) => {
        const contents = js.code + createCssInjection(modulePath, css?.code);
        return rewriteBareImportsForDev(contents, join(rootDir, modulePath)).then((rewritten) => {
          if (!rewritten.ok) {
            return rewritten;
          }
          if (shouldLog) {
            logRecompiledAsset(modulePath, rewritten.value);
          }
          return ok(rewritten.value);
        });
      },
      (error) => fail(`Failed to compile ${modulePath}: ${getErrorMessage(error)}`),
    );
};

export const transpileTypeScriptForDev = async (rootDir: string, modulePath: string, shouldLog = false): Promise<Result<string>> => {
  const source = await loadRequiredText(join(rootDir, modulePath));
  if (!source.ok) {
    return source;
  }

  return Promise.resolve()
    .then(() => {
      const transformed = tsTranspiler.transformSync(source.value);
      return rewriteBareImportsForDev(transformed, join(rootDir, modulePath)).then((rewritten) => {
        if (!rewritten.ok) {
          return rewritten;
        }
        if (shouldLog) {
          logRecompiledAsset(modulePath, rewritten.value);
        }
        return ok(rewritten.value);
      });
    })
    .catch((error) => fail(`Failed to transpile ${modulePath}: ${getErrorMessage(error)}`));
};

// ---- 模块加载 ----

const isCompilableDevModule = (filePath: string): boolean => isSupportedLocalSourceModule(filePath);

const getDevModuleMtime = (rootDir: string, modulePath: string): Result<number> => {
  try {
    return ok(statSync(join(rootDir, modulePath)).mtimeMs);
  } catch (error) {
    return fail(`Missing file: ${join(rootDir, modulePath)} (${getErrorMessage(error)})`);
  }
};

const loadUncachedDevModule = async (rootDir: string, modulePath: string, shouldLog = false): Promise<Result<string>> => {
  if (isSupportedSvelteSourceModule(modulePath)) {
    return compileSvelteForDev(rootDir, modulePath, shouldLog);
  }

  if (isSupportedJavaScriptSourceModule(modulePath)) {
    const source = await loadRequiredText(join(rootDir, modulePath));
    if (!source.ok) {
      return source;
    }
    const rewritten = await rewriteBareImportsForDev(source.value, join(rootDir, modulePath));
    if (!rewritten.ok) {
      return rewritten;
    }
    if (shouldLog) {
      logRecompiledAsset(modulePath, rewritten.value);
    }
    return ok(rewritten.value);
  }

  if (isSupportedTypeScriptSourceModule(modulePath)) {
    return transpileTypeScriptForDev(rootDir, modulePath, shouldLog);
  }

  return fail(`Unsupported dev module: ${modulePath}`);
};

export const loadDevModule = async (
  rootDir: string,
  modulePath: string,
  cache: DevCompileCache,
  allowedRoots?: string[],
  shouldLog = false,
): Promise<Result<string>> => {
  if (allowedRoots !== undefined && isCompilableDevModule(modulePath)) {
    const validatedImportGraph = await validateLocalSourceImportGraph(join(rootDir, modulePath), allowedRoots);
    if (!validatedImportGraph.ok) {
      return validatedImportGraph;
    }
  }

  const mtime = getDevModuleMtime(rootDir, modulePath);
  if (!mtime.ok) {
    return mtime;
  }

  const cacheKey = createDevCompileCacheKey(rootDir, modulePath);
  const cached = cache.read(cacheKey, mtime.value);
  if (cached !== undefined) {
    return ok(cached);
  }

  const loaded = await loadUncachedDevModule(rootDir, modulePath, shouldLog);
  if (!loaded.ok) {
    return loaded;
  }

  cache.write(cacheKey, mtime.value, loaded.value);
  return loaded;
};

export const compileChangedDevAsset = async (
  rootDir: string,
  modulePath: string,
  cache: DevCompileCache,
  allowedRoots: string[],
): Promise<void> => {
  cache.invalidate(createDevCompileCacheKey(rootDir, modulePath));
  const compiled = await loadDevModule(rootDir, modulePath, cache, allowedRoots, true);
  if (!compiled.ok) {
    console.error(compiled.error);
  }
};

// ---- 错误响应 ----

const createInternalServerErrorResponse = (): Response => new Response("Internal Server Error", { status: 500 });

const createNotFoundResponse = (): Response => new Response("Not Found", { status: 404 });

export const createDevModuleErrorResponse = (error: string): Response => {
  if (error.startsWith("Missing file:")) {
    return createNotFoundResponse();
  }
  console.error(error);
  return createInternalServerErrorResponse();
};
```

- [ ] **Step 2: 从 `dev.ts` 删除已提取的内容**

删除 `dev.ts` 中以下代码段：
- 第 160-278 行：`DevCompileCacheEntry`, `DevCompileCache`, `createDevCompileCache`, `createDevCompileCacheKey`, `getDevModuleMtime`, `loadUncachedDevModule`, `loadDevModule`, `compileChangedDevAsset`, `createInternalServerErrorResponse`, `createDevModuleErrorResponse`
- 第 140-156 行：`createRecompiledAssetReport`, `logRecompiledAsset`
- 第 158 行：`isCompilableDevModule`
- 第 467-481 行：`createImportMap`, `loadRequiredText`
- 第 486-502 行：`createCssInjection`
- 第 504-559 行：`compileSvelteForDev`, `transpileTypeScriptForDev`
- 第 280-288 行的 `createInternalServerErrorResponse` 和 `createDevModuleErrorResponse`
- 第 74 行的 `createNotFoundResponse`
- 第 467-469 行：`createImportMap`
- 第 484 行的 `tsTranspiler`

- [ ] **Step 3: 更新 `dev.ts` 的导入**

更新为：
```typescript
import {
  createDevCompileCache,
  createDevCompileCacheKey,
  createDevModuleErrorResponse,
  loadDevModule,
  compileChangedDevAsset,
  type DevCompileCache,
} from "./dev-compile";
```

同时移除不再需要的 import：`gzipSync` (from `node:zlib`), `compile` (from `svelte/compiler`), `lstatSync` (from `node:fs`), `statSync` (from `node:fs`), `dirname` (from `node:path`), `escapeHtml` (from `./import-utils`), `formatAssetReport` (from `./report`), `isSupportedJavaScriptSourceModule`, `isSupportedSvelteSourceModule`, `isSupportedTypeScriptSourceModule`, `isSupportedLocalSourceModule` (from `./source-modules`), `rewriteBareImportsForDev` (from `./dev-imports`).

保留 `createImportMap` — 它很短，内联到 `dev.ts` 的 fetch handler 中。

- [ ] **Step 4: 运行测试验证**

```bash
bun test && bun run typecheck
```
Expected: 全部通过。

- [ ] **Step 5: 提交**

```bash
git add src/builder/dev-compile.ts src/builder/dev.ts
git commit -m "refactor(builder): extract dev-compile.ts from dev.ts

- Extract DevCompileCache, loadDevModule, compileSvelteForDev,
  transpileTypeScriptForDev, compileChangedDevAsset
- dev.ts shrinks from 875 to ~550 lines

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: 拆分 `dev.ts` — 提取路由模块 `dev-router.ts`

**Files:**
- Create: `src/builder/dev-router.ts`
- Modify: `src/builder/dev.ts`

**Interfaces:**
- Produces: `resolveDevRequestPath()`, `resolveDevNodeModuleRequestPath()`, `findNodeModulesRoot()`, `getRawRequestPathname()`, `isPathInsideRoot()`, `createSSEResponse()` from dev-reload

- [ ] **Step 1: 创建 `src/builder/dev-router.ts`**

从 `dev.ts` 中提取路径解析相关函数：

```typescript
import { existsSync, lstatSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, relative } from "node:path";
import { ok, fail, type Result } from "./utils";

export const getRawRequestPathname = (requestUrl: string): string => {
  const schemeIndex = requestUrl.indexOf("://");
  const pathnameStart = schemeIndex === -1 ? requestUrl.indexOf("/") : requestUrl.indexOf("/", schemeIndex + 3);
  const pathnameWithQuery = pathnameStart === -1 ? "/" : requestUrl.slice(pathnameStart);
  const queryStart = pathnameWithQuery.search(/[?#]/);
  return queryStart === -1 ? pathnameWithQuery : pathnameWithQuery.slice(0, queryStart);
};

export const isPathInsideRoot = (rootDir: string, targetPath: string): boolean => {
  const relativePath = relative(rootDir, targetPath);
  return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
};

export const resolveDevRequestPath = async (
  rootDir: string,
  rawPathname: string,
  prefix: string,
): Promise<Result<{ filePath: string; modulePath: string; resolvedPath: string }>> => {
  const encodedPath = prefix === "/" ? rawPathname.slice(1) : rawPathname.slice(prefix.length);
  let decodedPath: string;

  try {
    decodedPath = decodeURIComponent(encodedPath);
  } catch {
    return fail("Rejected path");
  }

  const segments: string[] = [];
  for (const segment of decodedPath.replace(/\\/g, "/").split("/")) {
    if (segment.length === 0 || segment === ".") {
      continue;
    }
    if (segment === "..") {
      return fail("Rejected path");
    }
    segments.push(segment);
  }

  if (segments.length === 0) {
    return fail("Rejected path");
  }

  const modulePath = segments.join("/");
  const filePath = join(rootDir, modulePath);
  const pathStatus = (() => {
    try {
      return lstatSync(filePath);
    } catch {
      return undefined;
    }
  })();

  if (pathStatus?.isSymbolicLink()) {
    try {
      const realRootDir = realpathSync(rootDir);
      const realFilePath = realpathSync(filePath);
      if (!isPathInsideRoot(realRootDir, realFilePath)) {
        return fail("Rejected path");
      }
      return ok({ filePath, modulePath, resolvedPath: realFilePath });
    } catch {
      return fail("Rejected path");
    }
  }

  if (!(await Bun.file(filePath).exists())) {
    return ok({ filePath, modulePath, resolvedPath: filePath });
  }

  const realRootDir = realpathSync(rootDir);
  const realFilePath = realpathSync(filePath);
  if (!isPathInsideRoot(realRootDir, realFilePath)) {
    return fail("Rejected path");
  }

  return ok({ filePath, modulePath, resolvedPath: realFilePath });
};

const getNodeModulePackageNameSegments = (segments: string[]): string[] => {
  if (segments[0]?.startsWith("@")) {
    return segments.length >= 2 ? segments.slice(0, 2) : [];
  }
  return segments.length >= 1 ? segments.slice(0, 1) : [];
};

export const resolveDevNodeModuleRequestPath = async (
  nodeModulesRoot: string,
  rawPathname: string,
): Promise<Result<{ filePath: string; modulePath: string; packageRoot: string; resolvedPath: string }>> => {
  const encodedPath = rawPathname.slice("/_node_modules/".length);
  let decodedPath: string;

  try {
    decodedPath = decodeURIComponent(encodedPath);
  } catch {
    return fail("Rejected path");
  }

  const segments: string[] = [];
  for (const segment of decodedPath.replace(/\\/g, "/").split("/")) {
    if (segment.length === 0 || segment === ".") {
      continue;
    }
    if (segment === "..") {
      return fail("Rejected path");
    }
    segments.push(segment);
  }

  const packageNameSegments = getNodeModulePackageNameSegments(segments);
  if (packageNameSegments.length === 0 || segments.length <= packageNameSegments.length) {
    return fail("Rejected path");
  }

  const packagePath = join(nodeModulesRoot, ...packageNameSegments);
  let packageRoot: string;
  try {
    packageRoot = dirname(realpathSync(join(packagePath, "package.json")));
  } catch {
    return fail("Rejected path");
  }

  const moduleSegments = segments.slice(packageNameSegments.length);
  const modulePath = moduleSegments.join("/");
  const filePath = join(packagePath, modulePath);

  if (!(await Bun.file(filePath).exists())) {
    return ok({ filePath, modulePath, packageRoot, resolvedPath: filePath });
  }

  let resolvedPath: string;
  try {
    resolvedPath = realpathSync(filePath);
  } catch {
    return fail("Rejected path");
  }

  if (!isPathInsideRoot(packageRoot, resolvedPath)) {
    return fail("Rejected path");
  }

  return ok({ filePath, modulePath, packageRoot, resolvedPath });
};

export const findNodeModulesRoot = async (startDir: string): Promise<Result<string>> => {
  let current = startDir;
  let fallback: string | undefined;

  while (true) {
    const candidate = join(current, "node_modules", "svelte", "package.json");
    if (await Bun.file(candidate).exists()) {
      const nodeModulesDir = join(current, "node_modules");
      if (existsSync(join(nodeModulesDir, ".bun"))) {
        return ok(nodeModulesDir);
      }
      fallback ??= nodeModulesDir;
    }

    const parent = dirname(current);
    if (parent === current) {
      return fallback === undefined ? fail(`Unable to locate node_modules from ${startDir}`) : ok(fallback);
    }
    current = parent;
  }
};
```

- [ ] **Step 2: 从 `dev.ts` 删除已提取的部分**

删除 `dev.ts` 中：
- 第 291-464 行：`getRawRequestPathname`, `isPathInsideRoot`, `resolveDevRequestPath`, `getNodeModulePackageNameSegments`, `resolveDevNodeModuleRequestPath`, `findNodeModulesRoot`
- 第 280 行的 `createInternalServerErrorResponse`（已在 dev-compile.ts 中）

- [ ] **Step 3: 更新 `dev.ts` 的导入**

添加：
```typescript
import { getRawRequestPathname, isPathInsideRoot, resolveDevRequestPath, resolveDevNodeModuleRequestPath, findNodeModulesRoot } from "./dev-router";
```

移除不再需要的 import：`lstatSync`, `realpathSync` (from `node:fs`), `dirname` (from `node:path`)。

- [ ] **Step 4: 合并 fetch handler 中三个相似的源码请求分支**

将 `dev.ts` 中 `isSupportedTypeScriptSourceModule` / `isSupportedJavaScriptSourceModule` / `isSupportedSvelteSourceModule` 三个分支替换为：

```typescript
// 在 dev.ts 的 runConfiguredDevServer 函数内添加此辅助函数
const handleSourceModuleRequest = async (
  rawPathname: string,
  rootDir: string,
  sourceRoot: string,
  cache: DevCompileCache,
): Promise<Response | null> => {
  const resolvedSourcePath = await resolveDevRequestPath(rootDir, rawPathname, "/");
  if (!resolvedSourcePath.ok) {
    return null;
  }

  if (!isPathInsideRoot(sourceRoot, resolvedSourcePath.value.resolvedPath)) {
    return null;
  }

  const allowedRoots = [realpathSync(sourceRoot)];
  const source = await loadDevModule(rootDir, resolvedSourcePath.value.modulePath, cache, allowedRoots);
  if (!source.ok) {
    return createDevModuleErrorResponse(source.error);
  }

  return new Response(source.value, {
    headers: { "Content-Type": "application/javascript" },
  });
};
```

然后三个分支合并为：
```typescript
if (isSupportedLocalSourceModule(rawPathname)) {
  const result = await handleSourceModuleRequest(rawPathname, rootDir, currentState.sourceRoot, reloadHub.cache);
  if (result !== null) return result;
}
```

注意：需要从 `source-modules` 导入 `isSupportedLocalSourceModule` 替代三个独立检查函数。

- [ ] **Step 5: 将内联 `createImportMap` 放到 `dev.ts` 的合适位置**

移回 `runConfiguredDevServer` 函数的顶部（当前第 640 行位置）。

- [ ] **Step 6: 运行测试验证**

```bash
bun test && bun run typecheck
```
Expected: 全部通过。

- [ ] **Step 7: 提交**

```bash
git add src/builder/dev-router.ts src/builder/dev.ts
git commit -m "refactor(builder): extract dev-router.ts from dev.ts

- Extract path resolution functions: resolveDevRequestPath,
  resolveDevNodeModuleRequestPath, findNodeModulesRoot
- Merge 3 similar source request branches into handleSourceModuleRequest
- dev.ts shrinks from ~550 to ~300 lines

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: 管道化 `build.ts` 的 `buildSvelte()` 函数

**Files:**
- Modify: `src/builder/build.ts`

**Interfaces:**
- Consumes: `utils.ts` helpers, `build-config`, `assets`, `build-validate`, `build-publish`, `finalize-css`, `finalize-js`, `build-plugins`, `bootstrap`
- Produces: 相同的 `buildSvelte()` 签名，公共 API 不变

- [ ] **Step 1: 定义 `BuildContext` 类型和步骤函数**

将 `buildSvelte` 当前的第 175 行线性函数拆分为多个步骤。在 `build.ts` 中添加以下内容：

```typescript
/** 在 buildSvelte 各步骤间传递的上下文 */
type BuildContext = {
  rootDir: string;
  outDir: string;
  mountId: string;
  appTitle: string;
  appComponentPath: string;
  appSourceRoot: string;
  assetsDirs: ResolvedAssetsDir[];
  stripSvelteDiagnostics: boolean;
  sourcemap: boolean;
};

type BuildDirectories = {
  stageDir: string;
  tempOutDir: string;
  lockPath: string | null;
  bootstrapPath: string;
};

type BuildBundle = {
  outputs: BuildArtifact[];
  cssByPath: Map<string, string>;
};

type FinalizedJS = {
  entryAsset: FinalJavaScriptAsset;
  assets: FinalJavaScriptAsset[];
};

type FinalizedCSS = {
  content: string;
  finalFile: string;
};

const resolveBuildContext = async (rootDir: string, options: BuildSvelteOptions): Promise<Result<BuildContext>> => {
  // 从原 buildSvelte 的 213-237 行提取
  const outDir = resolveConfiguredPath(rootDir, options.outDir, "dist");
  const mountIdResult = validateMountId(options.mountId, "mountId");
  if (!mountIdResult.ok) return mountIdResult;
  const appComponentResult = validateAppComponent(options.appComponent, "appComponent");
  if (!appComponentResult.ok) return appComponentResult;
  const appComponentPath = resolveConfiguredPath(rootDir, appComponentResult.value, "src/App.svelte");
  const appSourceRoot = resolveAppSourceRoot(rootDir, appComponentPath);
  if (!appSourceRoot.ok) return appSourceRoot;
  const assetsDirs = await resolveConfiguredAssetsDirs(rootDir, options.assetsDirs, "assets");
  if (!assetsDirs.ok) return assetsDirs;

  const validatedOutDir = validateOutDir(rootDir, outDir, appSourceRoot.value);
  if (!validatedOutDir.ok) return validatedOutDir;

  return ok({
    rootDir,
    outDir: validatedOutDir.value,
    mountId: mountIdResult.value,
    appTitle: options.appTitle ?? DEFAULT_HTML_SHELL.title,
    appComponentPath,
    appSourceRoot: appSourceRoot.value,
    assetsDirs: assetsDirs.value,
    stripSvelteDiagnostics: options.stripSvelteDiagnostics ?? true,
    sourcemap: options.sourcemap ?? false,
  });
};

const verifyBuildInputs = async (ctx: BuildContext): Promise<Result<void>> => {
  // 从原 buildSvelte 的 247-265 行提取
  const entryExists = await Bun.file(ctx.appComponentPath).exists();
  if (!entryExists) return fail(`Missing SPA app component: ${ctx.appComponentPath}`);

  const validatedPath = validateResolvedAppComponentPath(ctx.rootDir, ctx.appSourceRoot, ctx.appComponentPath);
  if (!validatedPath.ok) return validatedPath;

  const validatedGraph = await validateLocalSourceImportGraph(ctx.appComponentPath, [realpathSync(ctx.appSourceRoot)]);
  if (!validatedGraph.ok) return validatedGraph;

  const validatedAliases = await validateSvelteBrowserImportAliases(ctx.rootDir);
  if (!validatedAliases.ok) return validatedAliases;

  return ok(undefined);
};

const setupBuildDirectories = async (ctx: BuildContext): Promise<Result<BuildDirectories & { lockPath: string; stageDir: string; tempOutDir: string }>> => {
  // 从原 buildSvelte 的 267-281 行提取
  const buildNonce = createBuildNonce();
  const stageDir = createStageDir(ctx.rootDir, ctx.outDir, buildNonce);
  const tempOutDir = createTempOutDir(ctx.outDir, buildNonce);

  const lock = await acquirePublishLock(ctx.rootDir, ctx.outDir);
  if (!lock.ok) return lock;

  const outDirReady = await prepareDir(tempOutDir);
  if (!outDirReady.ok) return outDirReady;

  const stageDirReady = await prepareDir(stageDir);
  if (!stageDirReady.ok) return stageDirReady;

  return ok({ lockPath: lock.value, stageDir, tempOutDir });
};

const generateBootstrap = async (ctx: BuildContext, dirs: BuildDirectories): Promise<Result<string>> => {
  // 从原 buildSvelte 的 282-291 行提取
  const bootstrapPath = join(dirs.stageDir, "bootstrap.ts");
  const bootstrapSource = createBootstrapSource(createImportPath(dirs.stageDir, ctx.appComponentPath), ctx.mountId);
  await writeFile(bootstrapPath, bootstrapSource, "utf8");
  return ok(bootstrapPath);
};

const runBunBuild = async (ctx: BuildContext, dirs: BuildDirectories, bootstrapPath: string): Promise<Result<BuildBundle>> => {
  // 从原 buildSvelte 的 293-315 行提取
  const cssByPath = new Map<string, string>();
  const bundle = await Bun.build({
    entrypoints: [bootstrapPath],
    format: "esm",
    minify: true,
    naming: {
      asset: "[hash].[ext]",
      chunk: "[hash].[ext]",
      entry: "[hash].[ext]",
    },
    outdir: dirs.stageDir,
    plugins: [
      createSvelteRuntimeAliasPlugin(ctx.rootDir),
      ctx.stripSvelteDiagnostics ? createProductionEsmEnvPlugin() : null,
      createSveltePlugin(cssByPath),
    ].filter((plugin): plugin is BunPlugin => plugin !== null),
    sourcemap: ctx.sourcemap ? "inline" : ("none" as BuildConfig["sourcemap"]),
    splitting: true,
    target: "browser",
  });
  if (!bundle.success) return fail(formatBuildLogs(bundle.logs));

  return ok({ outputs: bundle.outputs, cssByPath });
};

const finalizeJS = async (bundle: BuildBundle): Promise<Result<FinalizedJS & { assets: FinalJavaScriptAsset[] }>> => {
  // 从原 buildSvelte 的 317-329 行提取
  const rewrittenAssets = await finalizeJavaScriptAssets(bundle.outputs, createFinalAssetFile, MAX_JS_HASH_STABILIZATION_PASSES);
  if (!rewrittenAssets.ok) return rewrittenAssets;

  const entryAsset = rewrittenAssets.value.find((asset) => asset.kind === "entry-point");
  if (!entryAsset) return fail("Bun.build succeeded but emitted no JavaScript entry artifact.");

  return ok({ entryAsset, assets: rewrittenAssets.value });
};

const finalizeCSS = async (bundle: BuildBundle): Promise<Result<FinalizedCSS>> => {
  // 从原 buildSvelte 的 331-333 行提取
  const cssAsset = await finalizeMergedCssAsset(bundle.cssByPath, createFinalAssetFile);
  if (!cssAsset.ok) return cssAsset;
  return ok(cssAsset.value);
};
```

- [ ] **Step 2: 重写 `buildSvelte()` 函数**

替换原 `buildSvelte` 函数体（第 212-390 行）为：

```typescript
export const buildSvelte = async (options: BuildSvelteOptions = {}): Promise<Result<BuildArtifacts>> => {
  const rootDir = resolve(options.rootDir ?? process.cwd());

  const ctx = await resolveBuildContext(rootDir, options);
  if (!ctx.ok) return ctx;

  const verified = await verifyBuildInputs(ctx.value);
  if (!verified.ok) return verified;

  const dirs = await setupBuildDirectories(ctx.value);
  if (!dirs.ok) return dirs;

  const bootstrapPath = join(dirs.value.stageDir, "bootstrap.ts");
  const bootstrapSource = createBootstrapSource(
    createImportPath(dirs.value.stageDir, ctx.value.appComponentPath),
    ctx.value.mountId,
  );
  const bwResult = await writeFile(bootstrapPath, bootstrapSource, "utf8").then(
    () => ok(undefined),
    (error) => fail(`Failed to write bootstrap: ${getErrorMessage(error)}`),
  );
  if (!bwResult.ok) {
    await cleanupBuild(dirs.value.lockPath, dirs.value.stageDir, dirs.value.tempOutDir, false);
    return bwResult;
  }

  const bundle = await runBunBuild(ctx.value, dirs.value, bootstrapPath);
  if (!bundle.ok) {
    await cleanupBuild(dirs.value.lockPath, dirs.value.stageDir, dirs.value.tempOutDir, false);
    return bundle;
  }

  const js = await finalizeJS(bundle.value);
  if (!js.ok) {
    await cleanupBuild(dirs.value.lockPath, dirs.value.stageDir, dirs.value.tempOutDir, false);
    return js;
  }

  const css = await finalizeCSS(bundle.value);
  if (!css.ok) {
    await cleanupBuild(dirs.value.lockPath, dirs.value.stageDir, dirs.value.tempOutDir, false);
    return css;
  }

  const jsWrite = await writeJavaScriptAssets(dirs.value.tempOutDir, js.value.assets);
  if (!jsWrite.ok) {
    await cleanupBuild(dirs.value.lockPath, dirs.value.stageDir, dirs.value.tempOutDir, false);
    return jsWrite;
  }

  const cssFile = await writeCssAsset(dirs.value.tempOutDir, css.value);
  if (!cssFile.ok) {
    await cleanupBuild(dirs.value.lockPath, dirs.value.stageDir, dirs.value.tempOutDir, false);
    return cssFile;
  }

  const htmlFile = await writeIndexHtml(
    dirs.value.tempOutDir,
    createHtmlShell(ctx.value.mountId, ctx.value.appTitle),
    js.value.entryAsset.finalFile,
    cssFile.value,
  );
  if (!htmlFile.ok) {
    await cleanupBuild(dirs.value.lockPath, dirs.value.stageDir, dirs.value.tempOutDir, false);
    return htmlFile;
  }

  for (const assetsDir of ctx.value.assetsDirs) {
    const assetsOutDir = join(dirs.value.tempOutDir, assetsDir.dirName);
    const copied = await copyConfiguredAssets(assetsDir.physicalPath, assetsOutDir);
    if (!copied.ok) {
      await cleanupBuild(dirs.value.lockPath, dirs.value.stageDir, dirs.value.tempOutDir, false);
      return fail(copied.error);
    }
  }

  const published = await publishBuildOutput(ctx.value.rootDir, dirs.value.tempOutDir, ctx.value.outDir);
  if (!published.ok) {
    await cleanupBuild(dirs.value.lockPath, dirs.value.stageDir, dirs.value.tempOutDir, false);
    return published;
  }

  await cleanupBuild(dirs.value.lockPath, dirs.value.stageDir, dirs.value.tempOutDir, true);

  return ok({
    cssFile: cssFile.value,
    htmlFile: htmlFile.value,
    jsChunkFiles: js.value.assets
      .filter((asset) => asset.kind === "chunk")
      .map((asset) => asset.finalFile)
      .sort(),
    jsFile: js.value.entryAsset.finalFile,
    outDir: ctx.value.outDir,
  });
};

/** 清理构建临时文件 */
const cleanupBuild = async (lockPath: string | null, stageDir: string, tempOutDir: string, published: boolean): Promise<void> => {
  await rm(stageDir, { force: true, recursive: true }).catch(() => undefined);
  if (!published) {
    await rm(tempOutDir, { force: true, recursive: true }).catch(() => undefined);
  }
  if (lockPath) {
    await rm(lockPath, { force: true, recursive: true }).catch(() => undefined);
  }
};
```

注意：需要确保 `BuildArtifact` 类型正确导入（来自 `bun` 包），以及 `FinalJavaScriptAsset` 来自 `./finalize-js`。

- [ ] **Step 3: 修复 `build.ts` 中的导入**

确保 `build.ts` 导入所有需要在步骤函数中使用的类型和函数。需要额外导入 `realpathSync` (from `node:fs`)、`BuildConfig` (from `bun`)、`BunPlugin` (from `bun`)。

```typescript
import { realpathSync } from "node:fs";
import type { BuildArtifact, BuildConfig, BunPlugin } from "bun";
import { finalizeMergedCssAsset } from "./finalize-css";
import { finalizeJavaScriptAssets, type FinalJavaScriptAsset } from "./finalize-js";
```

- [ ] **Step 4: 运行测试验证**

```bash
bun test && bun run typecheck
```
Expected: 全部通过。

- [ ] **Step 5: 提交**

```bash
git add src/builder/build.ts
git commit -m "refactor(builder): pipeline buildSvelte into named steps

- Split 175-line buildSvelte into resolveBuildContext, verifyBuildInputs,
  setupBuildDirectories, runBunBuild, finalizeJS, finalizeCSS
- Introduce BuildContext type for step communication
- Centralize cleanup in cleanupBuild helper

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: 补测试 — `build-publish.ts`

**Files:**
- Create: `src/builder/tests/build-publish.test.ts`

- [ ] **Step 1: 创建 `build-publish.test.ts`**

```typescript
import { describe, expect, it } from "bun:test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

// 注意：这些函数使用 Bun 特有的 API（Bun.CryptoHasher），需要在 Bun 环境中运行
import {
  acquirePublishLock,
  createBuildNonce,
  createStageDir,
  createTempOutDir,
  publishBuildOutput,
} from "../build-publish";

describe("build-publish", () => {
  describe("createBuildNonce", () => {
    it("should return a non-empty hex string", () => {
      const nonce = createBuildNonce();
      expect(nonce.length).toBeGreaterThan(0);
      expect(nonce).toMatch(/^[0-9a-f]+$/);
    });

    it("should return unique values on each call", () => {
      const a = createBuildNonce();
      const b = createBuildNonce();
      expect(a).not.toBe(b);
    });
  });

  describe("createStageDir and createTempOutDir", () => {
    it("should create stage dir path under rootDir", () => {
      const nonce = createBuildNonce();
      const stageDir = createStageDir("/root", "/root/dist", nonce);
      expect(stageDir.startsWith("/root/")).toBe(true);
      expect(stageDir.includes(nonce)).toBe(true);
    });

    it("should create temp out dir path alongside outDir", () => {
      const nonce = createBuildNonce();
      const tempDir = createTempOutDir("/root/dist", nonce);
      expect(tempDir.startsWith("/root/")).toBe(true);
      expect(tempDir.includes(".bsp-out-")).toBe(true);
    });
  });

  describe("acquirePublishLock", () => {
    it("should acquire lock on fresh directory", async () => {
      const testDir = join("/tmp", `svelte-lib-test-lock-${Date.now()}`);
      mkdirSync(testDir, { recursive: true });
      const outDir = join(testDir, "dist");

      const lock = await acquirePublishLock(testDir, outDir);
      expect(lock.ok).toBe(true);
      if (lock.ok) {
        expect(existsSync(lock.value)).toBe(true);
        // Cleanup
        await (await import("node:fs/promises")).rm(lock.value, { force: true, recursive: true });
      }
      await (await import("node:fs/promises")).rm(testDir, { force: true, recursive: true });
    });

    it("should fail when lock is held by a live process", async () => {
      const testDir = join("/tmp", `svelte-lib-test-lock-${Date.now()}`);
      mkdirSync(testDir, { recursive: true });
      const outDir = join(testDir, "dist");
      const lockPath = `${outDir}.lock`;
      const ownerPath = join(lockPath, "owner.json");

      // Create lock as if held by current process
      mkdirSync(lockPath, { recursive: true });
      writeFileSync(ownerPath, JSON.stringify({ pid: process.pid }));

      const lock = await acquirePublishLock(testDir, outDir, false);
      expect(lock.ok).toBe(false);
      if (!lock.ok) {
        expect(lock.error).toContain("already running");
      }

      await (await import("node:fs/promises")).rm(testDir, { force: true, recursive: true });
    });
  });

  describe("publishBuildOutput", () => {
    it("should publish temp dir to outDir atomically", async () => {
      const testDir = join("/tmp", `svelte-lib-test-pub-${Date.now()}`);
      mkdirSync(testDir, { recursive: true });
      const outDir = join(testDir, "dist");
      const tempOutDir = join(testDir, ".dist.bsp-out-test");
      mkdirSync(tempOutDir, { recursive: true });
      writeFileSync(join(tempOutDir, "test.txt"), "hello");

      const result = await publishBuildOutput(testDir, tempOutDir, outDir);
      expect(result.ok).toBe(true);
      expect(existsSync(join(outDir, "test.txt"))).toBe(true);
      expect(existsSync(tempOutDir)).toBe(false);

      await (await import("node:fs/promises")).rm(testDir, { force: true, recursive: true });
    });

    it("should handle missing original outDir gracefully", async () => {
      const testDir = join("/tmp", `svelte-lib-test-pub-${Date.now()}`);
      mkdirSync(testDir, { recursive: true });
      const outDir = join(testDir, "dist-nonexistent");
      const tempOutDir = join(testDir, ".dist-nonexistent.bsp-out-test");
      mkdirSync(tempOutDir, { recursive: true });
      writeFileSync(join(tempOutDir, "test.txt"), "hello");

      const result = await publishBuildOutput(testDir, tempOutDir, outDir);
      expect(result.ok).toBe(true);

      await (await import("node:fs/promises")).rm(testDir, { force: true, recursive: true });
    });
  });
});
```

- [ ] **Step 2: 运行测试验证**

```bash
bun test src/builder/tests/build-publish.test.ts
```
Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add src/builder/tests/build-publish.test.ts
git commit -m "test(builder): add build-publish tests

- Test createBuildNonce, createStageDir, createTempOutDir
- Test acquirePublishLock for fresh and locked scenarios
- Test publishBuildOutput for normal and missing-target paths

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 7: 补测试 — `bootstrap.ts` 和 `runtime.ts` 和 `source-modules.ts`

**Files:**
- Create: `src/builder/tests/bootstrap.test.ts`
- Create: `src/builder/tests/source-modules.test.ts`
- Modify: `src/builder/tests/runtime.test.ts` (已有，补充用例)

- [ ] **Step 1: 创建 `bootstrap.test.ts`**

```typescript
import { describe, expect, it } from "bun:test";
import { createBootstrapSource, createImportPath } from "../bootstrap";

describe("bootstrap", () => {
  describe("createImportPath", () => {
    it("should create relative import starting with ./", () => {
      expect(createImportPath("/project/src", "/project/src/App.svelte")).toBe("./App.svelte");
    });

    it("should create relative import for nested paths", () => {
      expect(createImportPath("/project/src", "/project/src/components/Button.svelte")).toBe("./components/Button.svelte");
    });

    it("should handle windows-style paths", () => {
      expect(createImportPath("C:\\project\\src", "C:\\project\\src\\App.svelte")).toBe("./App.svelte");
    });
  });

  describe("createBootstrapSource", () => {
    it("should generate valid bootstrap module source", () => {
      const source = createBootstrapSource("./App.svelte", "app");
      expect(source).toContain('import App from "./App.svelte"');
      expect(source).toContain('document.getElementById("app")');
      expect(source).toContain('mount(App, {');
    });

    it("should use custom mount id", () => {
      const source = createBootstrapSource("./App.svelte", "root");
      expect(source).toContain('document.getElementById("root")');
    });

    it("should use default values when not provided", () => {
      const source = createBootstrapSource();
      expect(source).toContain('./src/App.svelte');
      expect(source).toContain('"app"');
    });
  });
});
```

- [ ] **Step 2: 创建 `source-modules.test.ts`**

```typescript
import { describe, expect, it } from "bun:test";
import {
  formatSupportedLocalSourceModuleExtensions,
  isSupportedJavaScriptSourceModule,
  isSupportedLocalSourceModule,
  isSupportedSvelteSourceModule,
  isSupportedTypeScriptSourceModule,
} from "../source-modules";

describe("source-modules", () => {
  describe("isSupportedSvelteSourceModule", () => {
    it("should return true for .svelte files", () => {
      expect(isSupportedSvelteSourceModule("App.svelte")).toBe(true);
      expect(isSupportedSvelteSourceModule("src/App.svelte")).toBe(true);
    });

    it("should return false for non-svelte files", () => {
      expect(isSupportedSvelteSourceModule("App.ts")).toBe(false);
      expect(isSupportedSvelteSourceModule("App.js")).toBe(false);
    });
  });

  describe("isSupportedTypeScriptSourceModule", () => {
    it("should return true for .ts files", () => {
      expect(isSupportedTypeScriptSourceModule("App.ts")).toBe(true);
      expect(isSupportedTypeScriptSourceModule("src/utils.ts")).toBe(true);
    });

    it("should return false for .d.ts files", () => {
      expect(isSupportedTypeScriptSourceModule("types.d.ts")).toBe(false);
    });

    it("should return false for non-ts files", () => {
      expect(isSupportedTypeScriptSourceModule("App.js")).toBe(false);
      expect(isSupportedTypeScriptSourceModule("App.svelte")).toBe(false);
    });
  });

  describe("isSupportedJavaScriptSourceModule", () => {
    it("should return true for .js files", () => {
      expect(isSupportedJavaScriptSourceModule("App.js")).toBe(true);
    });

    it("should return true for .mjs files", () => {
      expect(isSupportedJavaScriptSourceModule("App.mjs")).toBe(true);
    });

    it("should return false for .ts files", () => {
      expect(isSupportedJavaScriptSourceModule("App.ts")).toBe(false);
    });
  });

  describe("isSupportedLocalSourceModule", () => {
    it("should return true for supported extensions", () => {
      expect(isSupportedLocalSourceModule("App.svelte")).toBe(true);
      expect(isSupportedLocalSourceModule("App.ts")).toBe(true);
      expect(isSupportedLocalSourceModule("App.js")).toBe(true);
      expect(isSupportedLocalSourceModule("App.mjs")).toBe(true);
    });

    it("should return false for .d.ts files", () => {
      expect(isSupportedLocalSourceModule("types.d.ts")).toBe(false);
    });

    it("should return false for unsupported extensions", () => {
      expect(isSupportedLocalSourceModule("App.css")).toBe(false);
      expect(isSupportedLocalSourceModule("App.json")).toBe(false);
    });
  });

  describe("formatSupportedLocalSourceModuleExtensions", () => {
    it("should return comma-separated extensions", () => {
      const result = formatSupportedLocalSourceModuleExtensions();
      expect(result).toContain(".svelte");
      expect(result).toContain(".ts");
      expect(result).toContain(".js");
      expect(result).toContain(".mjs");
    });
  });
});
```

- [ ] **Step 3: 补充 `runtime.test.ts`**

在已有测试基础上增加用例：

```typescript
import { describe, expect, it } from "bun:test";
import { createRuntimeModuleSource } from "../runtime";

describe("runtime", () => {
  it("should generate runtime source with default mount id", () => {
    const source = createRuntimeModuleSource("app");
    expect(source).toContain('"app"');
    expect(source).toContain("getMountTarget");
  });

  // --- 新增 ---
  it("should generate runtime source with custom mount id", () => {
    const source = createRuntimeModuleSource("root");
    expect(source).toContain('"root"');
  });

  it("should trim whitespace from mount id", () => {
    const source = createRuntimeModuleSource("  app  ");
    expect(source).toContain('"app"');
  });

  it("should throw for invalid mount id containing spaces", () => {
    expect(() => createRuntimeModuleSource("app root")).toThrow();
  });

  it("should throw for mount id starting with #", () => {
    expect(() => createRuntimeModuleSource("#app")).toThrow();
  });
});
```

- [ ] **Step 4: 运行全部测试**

```bash
bun test
```
Expected: 全部通过。

- [ ] **Step 5: 提交**

```bash
git add src/builder/tests/bootstrap.test.ts src/builder/tests/source-modules.test.ts src/builder/tests/runtime.test.ts
git commit -m "test(builder): add bootstrap, source-modules, runtime tests

- bootstrap: createImportPath path handling, createBootstrapSource output
- source-modules: all 4 extension check functions
- runtime: additional mount id edge cases

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 8: 补测试 — `dev-reload.ts`

**Files:**
- Create: `src/builder/tests/dev-reload.test.ts`

- [ ] **Step 1: 创建 `dev-reload.test.ts`**

```typescript
import { describe, expect, it } from "bun:test";
import { shouldProcessDevWatchEvent, formatDevWatcherIssue, classifyDevWatchTarget } from "../dev-reload";

describe("dev-reload", () => {
  describe("classifyDevWatchTarget", () => {
    it("should classify config file change", () => {
      const result = classifyDevWatchTarget({
        eventPath: "/project/builder.ts",
        fileStatus: "file",
        filename: "builder.ts",
        watchDir: "/project",
      });
      expect(result.kind).toBe("config");
    });

    it("should classify module file change", () => {
      const result = classifyDevWatchTarget({
        eventPath: "/project/src/App.svelte",
        fileStatus: "file",
        filename: "App.svelte",
        watchDir: "/project/src",
      });
      expect(result.kind).toBe("module");
      if (result.kind === "module") {
        expect(result.modulePath).toBe("App.svelte");
      }
    });

    it("should classify .ts module file change", () => {
      const result = classifyDevWatchTarget({
        eventPath: "/project/src/utils.ts",
        fileStatus: "file",
        filename: "utils.ts",
        watchDir: "/project/src",
      });
      expect(result.kind).toBe("module");
    });

    it("should ignore node_modules directories", () => {
      const result = classifyDevWatchTarget({
        eventPath: "/project/node_modules/svelte",
        fileStatus: "directory",
        filename: "node_modules",
        watchDir: "/project",
      });
      expect(result.kind).toBe("ignore");
    });

    it("should ignore hidden directories", () => {
      const result = classifyDevWatchTarget({
        eventPath: "/project/.git",
        fileStatus: "directory",
        filename: ".git",
        watchDir: "/project",
      });
      expect(result.kind).toBe("ignore");
    });

    it("should ignore paths outside watch dir", () => {
      const result = classifyDevWatchTarget({
        eventPath: "/other/file.ts",
        fileStatus: "file",
        filename: "file.ts",
        watchDir: "/project",
      });
      expect(result.kind).toBe("ignore");
    });

    it("should ignore unsupported file extensions", () => {
      const result = classifyDevWatchTarget({
        eventPath: "/project/src/styles.css",
        fileStatus: "file",
        filename: "styles.css",
        watchDir: "/project/src",
      });
      expect(result.kind).toBe("ignore");
    });
  });

  describe("shouldProcessDevWatchEvent", () => {
    it("should process first event", () => {
      const events = new Map<string, number>();
      expect(shouldProcessDevWatchEvent(events, "src/App.svelte", 1000)).toBe(true);
    });

    it("should debounce rapid duplicate events", () => {
      const events = new Map<string, number>();
      const now = 1000;

      expect(shouldProcessDevWatchEvent(events, "src/App.svelte", now)).toBe(true);
      expect(shouldProcessDevWatchEvent(events, "src/App.svelte", now + 50)).toBe(false);
    });

    it("should allow events after debounce window", () => {
      const events = new Map<string, number>();
      const now = 1000;

      expect(shouldProcessDevWatchEvent(events, "src/App.svelte", now)).toBe(true);
      expect(shouldProcessDevWatchEvent(events, "src/App.svelte", now + 200)).toBe(true);
    });

    it("should clean up stale events", () => {
      const events = new Map<string, number>([["stale/file.ts", 500]]);
      shouldProcessDevWatchEvent(events, "src/App.svelte", 1000);

      expect(events.has("stale/file.ts")).toBe(false);
    });
  });

  describe("formatDevWatcherIssue", () => {
    it("should return undefined for ENOENT errors", () => {
      const error = Object.assign(new Error("ENOENT"), { code: "ENOENT" });
      expect(formatDevWatcherIssue("test", error)).toBeUndefined();
    });

    it("should return formatted message for other errors", () => {
      const error = new Error("Something went wrong");
      const result = formatDevWatcherIssue("watch setup", error);
      expect(result).toContain("watch setup");
      expect(result).toContain("Something went wrong");
    });
  });
});
```

- [ ] **Step 2: 运行测试验证**

```bash
bun test src/builder/tests/dev-reload.test.ts
```
Expected: PASS

- [ ] **Step 3: 提交**

```bash
git add src/builder/tests/dev-reload.test.ts
git commit -m "test(builder): add dev-reload tests

- classifyDevWatchTarget: config, module, ignore cases
- shouldProcessDevWatchEvent: first event, debounce, stale cleanup
- formatDevWatcherIssue: ignorable errors, format output

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 9: 清理 — `source-modules.ts` 使用类型常量

**Files:**
- Modify: `src/builder/source-modules.ts`

- [ ] **Step 1: 让 `isSupportedJavaScriptSourceModule` 引用 `SUPPORTED_LOCAL_SOURCE_MODULE_EXTENSIONS`**

```typescript
const JS_EXTENSIONS = [".js", ".mjs"] as const;

export const isSupportedJavaScriptSourceModule = (path: string): boolean =>
  JS_EXTENSIONS.some((ext) => path.endsWith(ext));
```

- [ ] **Step 2: 运行测试验证**

```bash
bun test && bun run typecheck
```
Expected: 全部通过。

- [ ] **Step 3: 提交**

```bash
git add src/builder/source-modules.ts
git commit -m "refactor(builder): use typed constant for JS extension check in source-modules

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 10: 清理 — `assets.ts` 使用 `fs.cp` 替代递归复制

**Files:**
- Modify: `src/builder/assets.ts`

- [ ] **Step 1: 替换 `copyDirectoryContents`**

```typescript
import { cp } from "node:fs/promises";

// 删除原有的 copyDirectoryContents 递归函数（第 161-212 行）
// 在 copyConfiguredAssets 中替换调用：

const copied = await cp(physicalAssetsRoot.value, physicalAssetsOutDir.value, {
  recursive: true,
  errorOnExist: false,
  filter: (source) => {
    // 拒绝符号链接
    try {
      const entry = (await import("node:fs")).lstatSync(source);
      return !entry.isSymbolicLink();
    } catch {
      return true;
    }
  },
}).then(
  () => ok(assetsOutDir),
  (error) => fail(`Failed to copy assets: ${error instanceof Error ? error.message : String(error)}`),
);
```

注意：使用 `cp` 时需要在文件顶部从 `node:fs/promises` 添加 `cp` 的导入。

- [ ] **Step 2: 运行测试验证**

```bash
bun test && bun run typecheck
```
Expected: 全部通过。

- [ ] **Step 3: 提交**

```bash
git add src/builder/assets.ts
git commit -m "refactor(builder): replace recursive copyDirectoryContents with fs.cp

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 11: 清理 — 消除 `finalize-css.ts` 的重复函数

**Files:**
- Modify: `src/builder/finalize-css.ts`

- [ ] **Step 1: 从 `utils.ts` 或 `build.ts` 导入 `formatBuildLogs` 和 `getBuildErrorMessage`**

将 `formatBuildLogs` 和 `getBuildErrorMessage` 从 `build.ts` 移到 `utils.ts`（如果它们还未在 utils.ts 中），或者在 `finalize-css.ts` 中从 `build.ts` 导入。

更简单的方案：将 `formatBuildLogs` 和 `getBuildErrorMessage` 也提取到 `utils.ts` 中。

在 `utils.ts` 中添加：
```typescript
export const formatBuildLogs = (logs: Array<{ message?: string; name?: string }>): string => {
  if (logs.length === 0) {
    return "Bun.build failed without diagnostic logs.";
  }
  return logs.map((log) => log.message ?? log.name ?? "Unknown build error").join("\n");
};

export const getBuildErrorMessage = (error: unknown): string => {
  if (typeof error === "object" && error !== null && "logs" in error && Array.isArray(error.logs)) {
    return formatBuildLogs(error.logs as Array<{ message?: string; name?: string }>);
  }
  return error instanceof Error ? error.message : String(error);
};
```

删除 `build.ts` 中的 `formatBuildLogs` 和 `getBuildErrorMessage`（第 138-152 行），改为从 `utils.ts` 导入。

删除 `finalize-css.ts` 中的 `formatBuildLogs` 和 `getBuildErrorMessage`（第 11-25 行），改为从 `utils.ts` 导入。

同时删除 `finalize-css.ts` 中的 `Result<T>` 类型、`ok`/`fail`（第 6-9 行），改为从 `utils.ts` 导入。

- [ ] **Step 2: 更新导入**

```typescript
// finalize-css.ts:
import { ok, fail, formatBuildLogs, getBuildErrorMessage, type Result } from "./utils";
```

- [ ] **Step 3: 运行测试验证**

```bash
bun test && bun run typecheck
```
Expected: 全部通过。

- [ ] **Step 4: 提交**

```bash
git add src/builder/utils.ts src/builder/build.ts src/builder/finalize-css.ts
git commit -m "refactor(builder): extract formatBuildLogs and getBuildErrorMessage to utils

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### 验证步骤

所有任务完成后，执行完整回归验证：

- [ ] **运行全部测试**

```bash
bun test
```

- [ ] **类型检查**

```bash
bun run typecheck
```

- [ ] **确认构建入口可用**

```bash
bun src/builder/build.ts --help  # 至少不崩溃
```

- [ ] **确认 dev 入口可用**

```bash
bun src/builder/dev.ts --help  # 至少不崩溃
```
