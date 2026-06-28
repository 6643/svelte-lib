# svelte-builder 重构设计文档

## 概述

对 `src/builder/`（基于 Bun + Svelte 5 的构建器/开发服务器）进行系统性重构，方向涵盖：消除重复基础设施代码、拆分大文件、管道化单体函数、补测试覆盖。执行策略为**分步渐进**，每步独立验证可回退。

---

## 第一步：提取共享基础设施 `utils.ts`

### 目标

消除跨 8+ 个文件的重复辅助函数，建立单一事实来源。

### 具体变更

**新文件：** `src/builder/utils.ts`

| 提取内容 | 当前定义位置 | 使用方 |
|---|---|---|
| `Result<T>` 类型 | `build.ts:44`, `assets.ts:4`, `build-validate.ts:22`, `build-publish.ts:6`, `finalize-css.ts:6`, `dev-imports.ts:4`, `build-config.ts:7`, `import-utils.ts`(无) | 几乎所有文件 |
| `ok()` / `fail()` 构造器 | `build.ts:86-88`, 其他文件类似 | 同上 |
| `getErrorMessage()` | `build.ts:90-96`, `build-publish.ts:16-22`, `build-validate.ts:27-33`, `build-config.ts:40-46`, `build-plugins.ts:7-10`, `dev-imports.ts:17-23`, `dev-reload.ts:28-34`, `dev.ts:60-66`, `load-config-runner.ts:5-11` | 9 个文件 |
| `getErrorCode()` | `build.ts:98-99`, `build-publish.ts:24-25`, `assets.ts:14-17`, `dev.ts:68-69` | 4 个文件 |
| `isPathWithinRoot()` | `build.ts:101-105`, `assets.ts:19-23`, `build-validate.ts:35-38`, `build-publish.ts:30-34` | 4 个文件 |
| `normalizeModulePath()` | `bootstrap.ts:3`, `dev.ts:80`, `dev-imports.ts:25`, `dev-config.ts:31` | 4 个文件 |
| `resolveConfiguredPath()` | `bootstrap.ts:11-14`, `build.ts:107-110` | 2 个文件 |

**注意：** `escapeHtml()` 已存在于 `import-utils.ts:149`，只需删除 `dev.ts:71` 的副本。

### 不动的内容

- `createPathHash()` (`build-publish.ts:27`)— 仅在单文件内使用，且 hash 长度不同，保留原位。
- `normalizeImportPath()` (`bootstrap.ts:3`) — 与 `normalizeModulePath()` 相同，统一为 `normalizeModulePath` 导出名。
- `finalize-css.ts` 的 `formatBuildLogs()`/`getBuildErrorMessage()` — 虽与 `build.ts` 重复，但与 CSS minification 逻辑耦合，延后到第五步清理。

### 变更文件

修改：`build.ts`, `assets.ts`, `build-validate.ts`, `build-publish.ts`, `build-config.ts`, `build-plugins.ts`, `dev.ts`, `dev-imports.ts`, `dev-reload.ts`, `bootstrap.ts`, `dev-config.ts`
新增：`utils.ts`

### 验收标准

- `bun test` 全部通过
- `bun run typecheck` 通过
- 无功能行为变更

---

## 第二步：拆分 `dev.ts` (875 行)

### 目标

将混合了 HTTP 路由、编译、缓存、日志的 875 行文件按职责拆为 4-5 个独立模块。

### 当前 dev.ts 的职责分布

| 行范围 | 职责 | 目标模块 |
|---|---|---|
| 1-96 | 导入、辅助函数（部分迁移至 utils.ts） | dev.ts 保留 |
| 97-157 | HTML shell 生成、日志 | dev.ts 保留 |
| 158-265 | 编译缓存、模块加载、编译函数 | `dev-compile.ts` |
| 266-289 | 编译缓存变动处理 + 错误响应 | `dev-compile.ts` |
| 290-464 | 路径解析（resolveDevRequestPath, resolveDevNodeModuleRequestPath, findNodeModulesRoot） | `dev-router.ts` |
| 465-558 | import map、loadRequiredText、compileSvelteForDev、transpileTypeScriptForDev | `dev-compile.ts` |
| 559-620 | 服务器启动逻辑 | dev.ts 保留 |
| 622-875 | `runConfiguredDevServer`（包含内联 fetch handler） + CLI | dev.ts 保留 |

### 拆分方案

```
dev.ts              →  入口 + 服务器启动 + fetch handler 路由 + CLI（≈250 行）
dev-compile.ts      →  compileSvelteForDev, transpileTypeScriptForDev, loadDevModule, 
                       loadUncachedDevModule, createDevCompileCache, compileChangedDevAsset
dev-router.ts       →  resolveDevRequestPath, resolveDevNodeModuleRequestPath, 
                       findNodeModulesRoot, getRawRequestPathname, isPathInsideRoot
```

### 关键设计：合并三个几乎相同的请求分支

当前 `.ts`/`.js`/`.svelte` 三个分支（`dev.ts:751-823`）结构完全相同，仅检查函数不同。统一为：

```typescript
const handleSourceModuleRequest = async (
  rootDir, rawPathname, currentState, reloadHub, loadFn
): Promise<Response | null> => { ... }
```

fetch handler 中对三个分支的调用简化为：

```typescript
const handlers = [
  [isSupportedTypeScriptSourceModule, loadDevModule],
  [isSupportedJavaScriptSourceModule, loadDevModule],
  [isSupportedSvelteSourceModule, loadDevModule],
];
for (const [check, load] of handlers) {
  if (check(rawPathname)) {
    return handleSourceModuleRequest(rootDir, rawPathname, currentState, reloadHub, load);
  }
}
```

### 验收标准

- `bun test` 全部通过
- `bun run typecheck` 通过
- dev server 功能不变（启动、编译、live reload、静态资源）

---

## 第三步：管道化 `build.ts` 的 `buildSvelte()` (175 行)

### 目标

将 `buildSvelte()` 从线性 175 行单体函数拆分为命名清晰的步骤函数。不打散到新文件，保持在 `build.ts` 内。

### 设计方案

```typescript
async function buildSvelte(options: BuildSvelteOptions = {}): Promise<Result<BuildArtifacts>> {
  const rootDir = resolve(options.rootDir ?? process.cwd());
  
  // 步骤 1：解析与验证配置
  const ctx = await resolveBuildContext(rootDir, options);
  if (!ctx.ok) return ctx;

  // 步骤 2：准备输出目录
  const dirs = await prepareBuildDirectories(ctx.value);
  if (!dirs.ok) return dirs;

  // 步骤 3：生成启动模块
  const bs = await generateBootstrap(ctx.value, dirs.value);
  if (!bs.ok) return bs;

  // 步骤 4：执行 Bun.build
  const built = await runBunBuild(ctx.value, dirs.value);
  if (!built.ok) return built;

  // 步骤 5：最终化 JS 资产
  const js = await finalizeJS(ctx.value, dirs.value, built.value);
  if (!js.ok) return js;

  // 步骤 6：最终化 CSS 资产
  const css = await finalizeCSS(ctx.value, dirs.value, built.value);
  if (!css.ok) return css;

  // 步骤 7：写入资产并发布
  return publishBuild(ctx.value, dirs.value, js.value, css.value);
}
```

每个 `buildXxx` 步骤函数 15-30 行，对应原 `buildSvelte` 中的一个自然阶段。步骤间通过 `BuildContext` 类型传递状态，不再使用累赘的 `let` 变量传递清理需要的临时状态。

### 认证与收敛

使用 `Result<T>` 模式，任一步骤失败即提前返回——与现有行为一致。`finally` 块的清理逻辑（`rm(stageDir)`、`rm(tempOutDir)`、`rm(lockPath)`）保持不动，只是不再访问局部 `let` 变量。

### 验收标准

- `bun test` 全部通过
- `bun run typecheck` 通过
- 构建产物与重构前一致

---

## 第四步：补测试覆盖

### 目标

补齐关键模块的测试缺口，增加错误路径覆盖。

### 测试计划

| 目标模块 | 当前覆盖 | 预期测试内容 |
|---|---|---|
| `build-publish.ts` | 0 行 | `acquirePublishLock()` — 正常获取、锁竞争（EEXIST）、stale Pid 回收、`allowRetry=false` 时快速失败<br>`publishBuildOutput()` — 正常发布、回滚、回滚后恢复失败<br>`cleanupRecoveredBuildState()` — 清理 stale stage/rollback/lock 目录 |
| `dev-reload.ts` | 仅 `classifyDevWatchTarget` | `createDevReloadHub()` — watch root 配置、目录递归 watch、事件通知<br>`shouldProcessDevWatchEvent()` — debounce<br>`createSSEResponse()` — SSE 流结构 |
| `bootstrap.ts` | 0 行 | `createBootstrapSource()` — mountId 拼接、import 路径处理<br>`resolveConfiguredPath()` — 绝对路径保留、相对路径拼接 |
| `runtime.ts` | 仅 1 case | `createRuntimeModuleSource()` — 不同 mountId 输出、快速失败验证 |
| `source-modules.ts` | 0 行 | `isSupportedLocalSourceModule()` — 各扩展名验证、`.d.ts` 排除 |

### 验收标准

- 新增测试全部通过
- 不影响现有测试
- 对 `build-publish.ts` 测试使用临时目录，避免污染工作树

---

## 第五步：其他清理项

| 问题 | 位置 | 变更 |
|---|---|---|
| 递归目录复制 | `assets.ts:161` `copyDirectoryContents()` | 替换为 `fs.cp(source, dest, { recursive: true })`（Node 20+） |
| `formatBuildLogs()` 重复 | `finalize-css.ts:11` 与 `build.ts:138` | 提取到共享位置或调用已有实现 |
| `getBuildErrorMessage()` 重复 | `finalize-css.ts:19` 与 `build.ts:146` | 同上 |
| 未使用常量的类型耦合 | `source-modules.ts:6` | `isSupportedJavaScriptSourceModule()` 改为引用 `SUPPORTED_LOCAL_SOURCE_MODULE_EXTENSIONS` |

### 验收标准

- `bun test` 全部通过
- `bun run typecheck` 通过

---

## 不变项

- 不改变公共 API（`_.ts` 导出、配置格式、CLI 接口）
- 不改变 `Result<T>` 模式风格（仅统一定义位置）
- 不改变 Svelte 升级敏感边界（HMR 客户端、dev/runtime alias）
- 不改变错误信息文案
- 不改变配置字段名称与默认值
- 不改变 HTML shell 结构

## 回退策略

每步独立提交，可单独 `git revert`。
