# Builder 简化重构实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 大幅简化 `src/builder/`，去掉过度设计，保留核心能力：Svelte SPA 构建 + 开发服务器

**Architecture:** build.ts 的发布锁/原子发布/JS hash 稳定化/CSS hash 稳定化/临时目录机制全部去掉，直接 `Bun.build` 输出到 outDir，只做后处理（CSS 合并写入、HTML 生成、assets 复制）。配置加载从 `load-config-runner.ts` 子进程方式改为 `import()` 直接加载。

**Tech Stack:** TypeScript, Bun, Svelte 5 compiler

## 全局约束

- 不改变 `_.ts` 的公共导出
- 不改变配置格式 `builder.ts` 字段名与默认值
- 不改变 `Result<T>` 模式风格
- 不改变 HTML shell 结构
- 不改变 Svelte 升级敏感边界（HMR 客户端引用 `svelte/internal/client`、dev/runtime alias）
- 每步必须 `bun test` 和 `bun run typecheck` 通过

---

### Task 1: 创建 `config.ts`，提取配置加载和验证逻辑

**Files:**
- Create: `src/builder/config.ts`
- Modify: `src/builder/build.ts`
- Delete: `src/builder/load-config-runner.ts`

**Interfaces:**
- Consumes: `Result<T>` 等基础类型 from `build.ts`
- Produces: `BuildSvelteOptions`, `defineSvelteConfig`, `loadSvelteConfig`, `CONFIG_FILE_NAME`, `validateMountId`, `validateAppComponent`, `resolveAppSourceRoot`, `validateResolvedAppComponentPath`

- [ ] **Step 1: 创建 `src/builder/config.ts`**

从 `build.ts` 提取：配置类型、字段校验、`defineSvelteConfig`、`loadSvelteConfig`、`resolveAppSourceRoot`、`validateResolvedAppComponentPath`

```typescript
import { existsSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { ok, err, getErrorMessage, isPathWithinRoot, type Result } from "./build";

export const CONFIG_FILE_NAME = "builder.ts";

export type BuildSvelteOptions = {
    appTitle?: string;
    appComponent?: string;
    assetsDirs?: string[];
    mountId?: string;
    outDir?: string;
    port?: number;
    rootDir?: string;
    stripSvelteDiagnostics?: boolean;
    sourcemap?: boolean;
};

const SUPPORTED_CONFIG_FIELDS = [
    "appComponent",
    "appTitle",
    "assetsDirs",
    "mountId",
    "outDir",
    "port",
    "rootDir",
    "sourcemap",
    "stripSvelteDiagnostics",
] as const;

const hasOwnProperty = (value: object, key: string): boolean => Object.prototype.hasOwnProperty.call(value, key);
const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const readOptionalStringField = (config: Record<string, unknown>, field: string): Result<string | undefined> => {
    if (!hasOwnProperty(config, field) || config[field] === undefined) {
        return ok(undefined);
    }
    if (typeof config[field] === "string") {
        return ok(config[field]);
    }
    return err(`Invalid ${field} in ${CONFIG_FILE_NAME}: expected string.`);
};

const readOptionalAssetsDirsField = (config: Record<string, unknown>, field: string): Result<string[] | undefined> => {
    if (!hasOwnProperty(config, field) || config[field] === undefined) {
        return ok(undefined);
    }
    if (Array.isArray(config[field]) && config[field].every((entry) => typeof entry === "string")) {
        return ok(config[field] as string[]);
    }
    return err(`Invalid ${field} in ${CONFIG_FILE_NAME}: expected string array.`);
};

const readOptionalAppComponentField = (config: Record<string, unknown>, field: string): Result<string | undefined> => {
    const appComponent = readOptionalStringField(config, field);
    if (!appComponent.ok) return appComponent;
    return ok(appComponent.value ?? "src/App.svelte");
};

const readOptionalNumberField = (config: Record<string, unknown>, field: string): Result<number | undefined> => {
    if (!hasOwnProperty(config, field) || config[field] === undefined) {
        return ok(undefined);
    }
    if (typeof config[field] === "number" && Number.isInteger(config[field]) && config[field] >= 0) {
        return ok(config[field]);
    }
    return err(`Invalid ${field} in ${CONFIG_FILE_NAME}: expected non-negative integer.`);
};

const readOptionalBooleanField = (config: Record<string, unknown>, field: string): Result<boolean | undefined> => {
    if (!hasOwnProperty(config, field) || config[field] === undefined) {
        return ok(undefined);
    }
    if (typeof config[field] === "boolean") {
        return ok(config[field]);
    }
    return err(`Invalid ${field} in ${CONFIG_FILE_NAME}: expected boolean.`);
};

export const validateMountId = (value: unknown, field: string): Result<string> => {
    if (value !== undefined && typeof value !== "string") {
        return err(`Invalid ${field} in ${CONFIG_FILE_NAME}: expected string.`);
    }
    const mountId = value ?? "app";
    const normalizedMountId = mountId.trim();
    if (normalizedMountId.length === 0) {
        return err(`Invalid ${field} in ${CONFIG_FILE_NAME}: expected a non-empty id token.`);
    }
    if (normalizedMountId !== mountId) {
        return err(`Invalid ${field} in ${CONFIG_FILE_NAME}: expected a plain id token, not a selector-shaped value.`);
    }
    if (/\s/u.test(normalizedMountId) || normalizedMountId.startsWith("#")) {
        return err(`Invalid ${field} in ${CONFIG_FILE_NAME}: expected a plain id token, not a selector-shaped value.`);
    }
    return ok(normalizedMountId);
};

export const validateAppComponent = (value: unknown, field: string): Result<string> => {
    if (value !== undefined && typeof value !== "string") {
        return err(`Invalid ${field} in ${CONFIG_FILE_NAME}: expected string.`);
    }
    const appComponent = value ?? "src/App.svelte";
    const normalizedAppComponent = appComponent.trim();
    if (normalizedAppComponent.length === 0) {
        return err(`Invalid ${field} in ${CONFIG_FILE_NAME}: expected a non-empty component path.`);
    }
    if (normalizedAppComponent !== appComponent) {
        return err(`Invalid ${field} in ${CONFIG_FILE_NAME}: expected a plain component path, not a whitespace-padded value.`);
    }
    return ok(normalizedAppComponent);
};

export const parseBuildConfig = (value: unknown, configFileName = CONFIG_FILE_NAME): Result<BuildSvelteOptions> => {
    if (!isRecord(value)) {
        return err(`Invalid ${configFileName}: expected a default-exported object config.`);
    }
    if (hasOwnProperty(value, "htmlTemplate")) {
        return err(`Invalid htmlTemplate in ${configFileName}: htmlTemplate is no longer supported.`);
    }
    const unknownField = Object.keys(value).find(
        (field) => !SUPPORTED_CONFIG_FIELDS.includes(field as (typeof SUPPORTED_CONFIG_FIELDS)[number]),
    );
    if (unknownField !== undefined) {
        return err(`Unknown field in ${configFileName}: ${unknownField}.`);
    }

    const appTitle = readOptionalStringField(value, "appTitle");
    if (!appTitle.ok) return appTitle;
    const appComponent = readOptionalAppComponentField(value, "appComponent");
    if (!appComponent.ok) return appComponent;
    if (hasOwnProperty(value, "assetsDir")) {
        return err(`Unknown field in ${configFileName}: assetsDir.`);
    }
    const assetsDirs = readOptionalAssetsDirsField(value, "assetsDirs");
    if (!assetsDirs.ok) return assetsDirs;
    const outDir = readOptionalStringField(value, "outDir");
    if (!outDir.ok) return outDir;
    const mountId = readOptionalStringField(value, "mountId");
    if (!mountId.ok) return mountId;
    const normalizedMountId = validateMountId(mountId.value, "mountId");
    if (!normalizedMountId.ok) return normalizedMountId;
    const port = readOptionalNumberField(value, "port");
    if (!port.ok) return port;
    const sourcemap = readOptionalBooleanField(value, "sourcemap");
    if (!sourcemap.ok) return sourcemap;
    const stripSvelteDiagnostics = readOptionalBooleanField(value, "stripSvelteDiagnostics");
    if (!stripSvelteDiagnostics.ok) return stripSvelteDiagnostics;

    return ok({
        appTitle: appTitle.value,
        appComponent: appComponent.value,
        assetsDirs: assetsDirs.value,
        mountId: normalizedMountId.value,
        outDir: outDir.value,
        port: port.value,
        stripSvelteDiagnostics: stripSvelteDiagnostics.value,
        sourcemap: sourcemap.value,
    });
};

export const defineSvelteConfig = (config: BuildSvelteOptions): BuildSvelteOptions => config;

export const loadSvelteConfig = async (cwd = process.cwd()): Promise<Result<BuildSvelteOptions>> => {
    const configRoot = resolve(cwd);
    const configPath = join(configRoot, CONFIG_FILE_NAME);
    const configExists = await Bun.file(configPath).exists();
    if (!configExists) {
        const legacyJsonConfigPath = join(configRoot, "svelte-builder.config.json");
        if (await Bun.file(legacyJsonConfigPath).exists()) {
            return err(`Legacy config is no longer supported: ${legacyJsonConfigPath}. Rename it to ${configPath}.`);
        }
        return err(`Missing config: ${configPath}`);
    }

    // 直接 import 加载配置文件
    try {
        const loaded = await import(pathToFileURL(configPath).href);
        const parsed = parseBuildConfig(loaded.default, CONFIG_FILE_NAME);
        if (!parsed.ok) return parsed;
        return ok({
            ...parsed.value,
            rootDir: configRoot,
        });
    } catch (error) {
        return err(`Failed to load ${configPath}: ${getErrorMessage(error)}`);
    }
};

export const resolveAppSourceRoot = (
    rootDir: string,
    appComponentPath: string,
    configFileName = CONFIG_FILE_NAME,
): Result<string> => {
    const appComponentRelativeToRoot = relative(rootDir, appComponentPath);
    if (appComponentRelativeToRoot.startsWith("..") || isAbsolute(appComponentRelativeToRoot)) {
        return err(`Invalid appComponent in ${configFileName}: expected a path inside the project root.`);
    }
    const segments = appComponentRelativeToRoot.split(/[\\/]/).filter((segment) => segment.length > 0);
    const [topLevelDir] = segments;
    if (topLevelDir === undefined || segments.length <= 1) {
        return err(
            `Invalid appComponent in ${configFileName}: expected a component path inside src/ or another top-level source directory.`,
        );
    }
    return ok(topLevelDir === "src" ? join(rootDir, "src") : join(rootDir, topLevelDir));
};

export const validateResolvedAppComponentPath = (
    rootDir: string,
    appSourceRoot: string,
    resolvedAppComponentPath: string,
    configFileName = CONFIG_FILE_NAME,
): Result<string> => {
    const physicalPath = (() => {
        try {
            return realpathSync(resolvedAppComponentPath);
        } catch {
            return null;
        }
    })();
    if (physicalPath === null) {
        return ok(resolvedAppComponentPath);
    }
    if (!isPathWithinRoot(rootDir, physicalPath) || !isPathWithinRoot(appSourceRoot, physicalPath)) {
        return err(
            `Invalid appComponent in ${configFileName}: symbolic links must resolve inside the app source tree (${appSourceRoot}).`,
        );
    }
    return ok(resolvedAppComponentPath);
};
```

- [ ] **Step 2: 从 `build.ts` 删除已提取的内容**

删除：`BuildSvelteOptions` 类型、`CONFIG_FILE_NAME` 常量、`defineSvelteConfig`、`loadSvelteConfig`、`parseBuildConfig`、所有 `readOptional*Field` 辅助函数、`validateMountId`、`validateAppComponent`、`resolveAppSourceRoot`、`validateResolvedAppComponentPath`、`isRecord`、`hasOwnProperty`、`SUPPORTED_CONFIG_FIELDS`、以及 `load-config-runner.ts` 的导入相关代码。

添加导入：
```typescript
import { defineSvelteConfig, loadSvelteConfig, validateMountId, validateAppComponent, resolveAppSourceRoot, validateResolvedAppComponentPath, type BuildSvelteOptions } from "./config";
```

注意：`build.ts` 仍需要导出 `defineSvelteConfig`, `loadSvelteConfig`, `BuildSvelteOptions` 等（通过 `_.ts` 的 re-export），所以要在 `build.ts` 中添加：
```typescript
export { defineSvelteConfig, loadSvelteConfig, type BuildSvelteOptions } from "./config";
```

- [ ] **Step 3: 删除 `load-config-runner.ts`**

```bash
git rm src/builder/load-config-runner.ts
```

- [ ] **Step 4: 更新 `_.ts` 的导出**

编辑 `src/builder/_.ts`，保持原有公共 API 不变。如果某些导出现在来自 `config.ts`，添加对应的 re-export。

- [ ] **Step 5: 运行测试验证**

```bash
bun test && bun run typecheck
```
Expected: 全部通过。

- [ ] **Step 6: 提交**

```bash
git add src/builder/config.ts src/builder/build.ts src/builder/_.ts
git rm src/builder/load-config-runner.ts
git commit -m "refactor(builder): extract config.ts, drop load-config-runner.ts

- Extract config loading/validation to config.ts
- Replace subprocess-based config loading with direct import()
- Delete load-config-runner.ts

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: 简化 `build.ts` — 去掉发布锁、原子发布、stage/temp 目录

**Files:**
- Modify: `src/builder/build.ts`
- Modify: `src/builder/assets.ts`

**Interfaces:**
- Consumes: 不变
- Produces: 简化的 `buildSvelte()` — 直接 `Bun.build` 到 outDir，然后 CSS/HTML/Assets 后处理

- [ ] **Step 1: 删除发布锁和原子发布相关函数**

从 `build.ts` 删除以下函数：
- `createBuildNonce`
- `createStageDir`
- `createTempOutDir`
- `acquirePublishLock`
- `createPublishLockPath`
- `createPendingPublishLockPath`
- `createPublishLockOwnerPath`
- `isPidAlive`
- `publishBuildOutput`
- `createRollbackOutDirPrefix`
- `createRollbackOutDir`
- `cleanupRecoveredBuildState`
- `cleanupLegacyReleaseTarget`
- `cleanupRecoveredRollbackOutDirs`
- `pathExists`
- `resolveLegacyReleaseTarget`
- `STAGE_OUTDIR_NAME`, `TEMP_OUTDIR_NAME`, `RELEASES_DIR_NAME`, `PUBLISH_PATH_HASH_HEX_LENGTH`

删除导入：`randomUUID` from `crypto`, `rename` from `fs/promises`, `readdir` from `fs/promises`, `readdirSync` from `fs`

- [ ] **Step 2: 重写 `buildSvelte` — 直出到 outDir，去掉 stage/temp/lock**

简化后的流水线：

```typescript
export const buildSvelte = async (options: BuildSvelteOptions = {}): Promise<Result<BuildArtifacts>> => {
    const rootDir = resolve(options.rootDir ?? process.cwd());

    // 1. 解析和验证配置
    const ctx = await resolveBuildContext(rootDir, options);
    if (!ctx.ok) return ctx;

    // 2. 验证构建输入
    const verified = await verifyBuildInputs(ctx.value);
    if (!verified.ok) return verified;

    // 3. 准备输出目录
    const outDirReady = await prepareDir(ctx.value.outDir);
    if (!outDirReady.ok) return outDirReady;

    // 4. 生成 bootstrap
    const bootstrapSource = createBootstrapSource(
        createImportPath(ctx.value.rootDir, ctx.value.appComponentPath),
        ctx.value.mountId,
    );
    const stageDir = join(ctx.value.rootDir, `.bsp-stage-${Date.now()}`);
    await mkdir(stageDir, { recursive: true });
    const bootstrapPath = join(stageDir, "bootstrap.ts");
    await writeFile(bootstrapPath, bootstrapSource, "utf8");

    // 5. Bun.build 直接输出到 outDir
    const cssByPath = new Map<string, string>();
    const bundle = await Bun.build({
        entrypoints: [bootstrapPath],
        outdir: ctx.value.outDir,
        format: "esm",
        minify: true,
        naming: {
            asset: "[hash].[ext]",
            chunk: "[hash].[ext]",
            entry: "[hash].[ext]",
        },
        plugins: [
            createSvelteRuntimeAliasPlugin(ctx.value.rootDir),
            ctx.value.stripSvelteDiagnostics ? createProductionEsmEnvPlugin() : null,
            createSveltePlugin(cssByPath),
        ].filter((plugin): plugin is BunPlugin => plugin !== null),
        sourcemap: ctx.value.sourcemap ? "inline" : ("none" as BuildConfig["sourcemap"]),
        splitting: true,
        target: "browser",
    });
    if (!bundle.success) return err(formatBuildLogs(bundle.logs));

    // 6. 清理 bootstrap 临时文件
    await rm(stageDir, { force: true, recursive: true }).catch(() => undefined);

    // 7. 找到 entry JS 和 chunks
    const outputs = bundle.outputs;
    const entryOutput = outputs.find(
        (o) => o.kind === "entry-point" && o.path.endsWith(".js"),
    );
    if (!entryOutput) return err("Bun.build succeeded but emitted no JavaScript entry artifact.");
    const entryFile = basename(entryOutput.path);
    const chunkFiles = outputs
        .filter((o) => o.kind === "chunk" && o.path.endsWith(".js"))
        .map((o) => basename(o.path))
        .sort();

    // 8. 合并 CSS 并写入
    const cssContent = Array.from(cssByPath.values()).join("\n");
    const cssMinified = cssContent.length > 0 ? await minifyCss(cssContent) : "";
    const cssFile = cssMinified.length > 0 ? `${createContentHash(cssMinified, 8)}.css` : "";
    if (cssFile) {
        await writeFile(join(ctx.value.outDir, cssFile), cssMinified, "utf8");
    }

    // 9. 生成 HTML
    const htmlFile = "index.html";
    await writeIndexHtml(
        ctx.value.outDir,
        createHtmlShell(ctx.value.mountId, ctx.value.appTitle),
        entryFile,
        cssFile,
    );

    // 10. 复制 assets
    for (const assetsDir of ctx.value.assetsDirs) {
        const assetsOutDir = join(ctx.value.outDir, assetsDir.dirName);
        const copied = await copyConfiguredAssets(assetsDir.physicalPath, assetsOutDir);
        if (!copied.ok) return copied;
    }

    return ok({
        cssFile,
        htmlFile,
        jsChunkFiles: chunkFiles,
        jsFile: entryFile,
        outDir: ctx.value.outDir,
    });
};
```

注意：`cssFile` 可能为空字符串（没有 CSS 时），`writeIndexHtml` 需要兼容无 CSS 的情况。

- [ ] **Step 3: 添加 `createContentHash` 和 `minifyCss` 辅助函数**

```typescript
const createContentHash = (content: string, length: number): string =>
    new Bun.CryptoHasher("sha256").update(content).digest("hex").slice(0, length);

const minifyCss = async (content: string): Promise<string> => {
    const tempFile = join("/tmp", `svelte-lib-css-${randomUUID()}.css`);
    try {
        await writeFile(tempFile, content, "utf8");
        const result = await Bun.build({
            entrypoints: [tempFile],
            minify: true,
            target: "browser",
        } as BuildConfig);
        if (!result.success) return content; // fallback: 返回未压缩内容
        const asset = result.outputs.find((o) => o.path.endsWith(".css"));
        return asset ? (await asset.text()).trimEnd() : content;
    } catch {
        return content;
    } finally {
        await rm(tempFile, { force: true }).catch(() => undefined);
    }
};
```

- [ ] **Step 4: 简化 `writeIndexHtml` — 支持无 CSS**

```typescript
const writeIndexHtml = async (outDir: string, shell: HtmlShell, jsFile: string, cssFile: string): Promise<Result<string>> => {
    const cssLink = cssFile ? `    <link rel="stylesheet" href="/${cssFile}">\n` : "";
    const html = [
        "<!DOCTYPE html>",
        `<html lang="${escapeHtml(shell.lang)}">`,
        "<head>",
        '    <meta charset="UTF-8">',
        '    <meta name="viewport" content="width=device-width, initial-scale=1.0">',
        `    <title>${escapeHtml(shell.title)}</title>`,
        cssLink.trimEnd(),
        "</head>",
        "<body>",
        `    ${shell.appHtml}`,
        `    <script type="module" src="/${jsFile}"></script>`,
        "</body>",
        "</html>",
    ].join("\n");

    return writeFile(join(outDir, "index.html"), html, "utf8").then(
        () => ok("index.html"),
        (error) => err(`Failed to write index.html: ${getErrorMessage(error)}`),
    );
};
```

- [ ] **Step 5: 简化 `prepareDir` — 不再需要 `rm` 前置清理**

```typescript
const prepareDir = async (path: string): Promise<Result<string>> =>
    mkdir(path, { recursive: true }).then(
        () => ok(path),
        (error) => err(`Failed to create ${path}: ${getErrorMessage(error)}`),
    );
```

- [ ] **Step 6: 删除不再需要导入的函数**

删除对 `finalizeMergedCssAsset`、`finalizeJavaScriptAssets`（来自 `./assets`）的引用。删除 `rename`、`readdir` 导入。

- [ ] **Step 7: 更新 `build.ts` 中的 `runBuildCli` 和 CLI 入口**

`runBuildCli` 函数保持不变，只是内部的 `buildSvelte` 已经简化。

- [ ] **Step 8: 运行测试验证**

```bash
bun test && bun run typecheck
```
Expected: 全部通过。

注意：`build-publish.test.ts` 会因为没有 `acquirePublishLock` 等函数而失败，需要更新；`finalize-css.test.ts` 和 `finalize-js.test.ts` 也需要更新。这些在下一步处理。

- [ ] **Step 9: 提交**

```bash
git add src/builder/build.ts
git commit -m "refactor(builder): simplify build pipeline

- Remove publish lock, atomic publish, stage/temp directories
- Remove JS/CSS hash stabilization, use Bun naming directly
- Bun.build outputs directly to outDir
- Simplify writeIndexHtml to support no-CSS case

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: 清理 `assets.ts` — 去掉 `finalizeJavaScriptAssets` 和 `finalizeMergedCssAsset`

**Files:**
- Modify: `src/builder/assets.ts`

- [ ] **Step 1: 从 `assets.ts` 删除不再需要的内容**

删除：`StagedJavaScriptAsset`, `FinalJavaScriptAsset`, `finalizeJavaScriptAssets`, `finalizeMergedCssAsset`, `minifyCssContent` 以及所有相关辅助函数。

保留：`ResolvedAssetsDir`, `resolveConfiguredAssetsDirs`, `resolveAssetPath`, `resolvePhysicalAssetPath`, `copyConfiguredAssets`

- [ ] **Step 2: 删除不再需要的导入**

删除：`BuildArtifact`, `BuildConfig` 类型的导入（如果不再使用），`randomUUID` from `crypto`，`basename`, `dirname` 等不再使用的 path 函数。

- [ ] **Step 3: 运行测试验证**

```bash
bun test && bun run typecheck
```
Expected: `finalize-css.test.ts` 和 `finalize-js.test.ts` 报错（它们测试的函数已被删除），其他测试通过。

- [ ] **Step 4: 提交**

```bash
git add src/builder/assets.ts
git commit -m "refactor(builder): remove JS/CSS finalization from assets

- Delete finalizeJavaScriptAssets, finalizeMergedCssAsset
- assets.ts now only handles directory resolution and copy

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: 更新测试 — 删除/更新受影响的测试文件

**Files:**
- Delete: `src/builder/tests/finalize-css.test.ts`
- Delete: `src/builder/tests/finalize-js.test.ts`
- Delete: `src/builder/tests/build-publish.test.ts`
- Modify: `src/builder/tests/build-lazy-chunks.test.ts`
- Modify: `src/builder/tests/load-config.test.ts`

- [ ] **Step 1: 删除 finalize-css.test.ts**

```bash
git rm src/builder/tests/finalize-css.test.ts
```

- [ ] **Step 2: 删除 finalize-js.test.ts**

```bash
git rm src/builder/tests/finalize-js.test.ts
```

- [ ] **Step 3: 删除 build-publish.test.ts**

```bash
git rm src/builder/tests/build-publish.test.ts
```

- [ ] **Step 4: 更新 load-config.test.ts**

将导入从 `../build` 改为 `../config`：

```typescript
import { loadSvelteConfig } from "../config";
```

删除第 72-91 行的"不泄露 side effect"测试用例（`loadSvelteConfig does not leak builder.ts side effects into the current process`），因为直接 `import()` 不再隔离 side effect。

- [ ] **Step 5: 更新 build-lazy-chunks.test.ts**

更新 `buildSvelte` 调用 — 简化后的 `buildSvelte` 返回的 `jsFile` 是 Bun 生成的 hash 文件名（如 `f35ba271.js`）。

修改 `build-lazy-chunks.test.ts` 中的 hash 检查，适配简化后的输出格式（Bun 的 `[hash]` 是 8 字符十六进制）。

```typescript
// hash 文件名格式检查
expect(/^[a-f0-9]{8}\.js$/.test(result.value.jsFile)).toBe(true);
```

- [ ] **Step 6: 运行测试验证**

```bash
bun test && bun run typecheck
```
Expected: 全部通过。

- [ ] **Step 7: 提交**

```bash
git add src/builder/tests/
git rm src/builder/tests/finalize-css.test.ts src/builder/tests/finalize-js.test.ts src/builder/tests/build-publish.test.ts
git commit -m "test(builder): update tests for simplified build pipeline

- Remove tests for deleted functions (finalizeJS, finalizeCSS, publish)
- Update load-config tests to use direct import() loading
- Update build-lazy-chunks assertions for simplified output

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: 更新 `dev.ts` 的导入路径

**Files:**
- Modify: `src/builder/dev.ts`

- [ ] **Step 1: 更新 dev.ts 中的导入**

`dev.ts` 从 `./build` 导入 `loadSvelteConfig` 等函数，现在需要从 `./config` 导入：

```typescript
import {
    loadSvelteConfig,
    type BuildSvelteOptions,
} from "./config";
```

同时保留从 `./build` 的其他必要导入。

- [ ] **Step 2: 运行测试验证**

```bash
bun test && bun run typecheck
```
Expected: 全部通过。

- [ ] **Step 3: 提交**

```bash
git add src/builder/dev.ts
git commit -m "fix(builder): update dev.ts imports for config.ts extraction

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

- [ ] **确认 demo 构建可用**

```bash
cd demo && bun run build
```

- [ ] **最终提交**

```bash
git add -A
git commit -m "refactor(builder): simplify builder architecture

- Extract config.ts with direct import() config loading
- Remove publish lock, atomic publish, stage/temp directories
- Remove JS/CSS hash stabilization, use Bun naming directly
- Clean up tests for removed functionality

Co-Authored-By: Claude <noreply@anthropic.com>"
```
