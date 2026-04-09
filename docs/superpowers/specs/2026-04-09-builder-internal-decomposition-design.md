# Builder Internal Decomposition Design

## 目标

- 将 `src/builder/build.ts` 和 `src/builder/dev.ts` 从超长单文件拆成职责清晰的内部模块
- 不改变公开 API
- 不改变 `svelte-build` / `svelte-dev` 行为
- 不新增配置，不借机删功能

## 非目标

- 不改 `svelte-lib/builder` 的导出面
- 不做多包化
- 不改 `builder.ts` 配置语义
- 不把这次拆分包装成产品能力变化

## 现状约束

- `build.ts` 当前同时承担：
  - 配置解析
  - 源码边界校验
  - bundling orchestration
  - 产物后处理
  - 发布目录切换
  - CLI 入口
- `dev.ts` 当前同时承担：
  - 配置推导
  - import 重写
  - 模块编译
  - watch / reload
  - HTTP 路由分发
  - CLI server 启动
- 当前仓库已经有一些可复用小模块：
  - `assets.ts`
  - `finalize-js.ts`
  - `finalize-css.ts`
  - `bootstrap.ts`
  - `report.ts`

## 主方案

采用“中等力度拆分，保留现有 API”的方案。

### `build.ts` 拆分目标

保留在 `build.ts` 中：

- `buildSvelte`
- `runConfiguredBuild`
- `runBuildCli`
- 顶层 orchestration

拆出去：

- `build-config.ts`
  - `BuildSvelteOptions`
  - `defineSvelteConfig`
  - `loadSvelteConfig`
  - 配置字段解析与默认值处理
- `build-validate.ts`
  - `resolveAppSourceRoot`
  - `validateResolvedAppComponentPath`
  - `validateLocalSourceImportGraph`
  - `validateSvelteBrowserImportAliases`
- `build-publish.ts`
  - stage/temp 目录
  - publish lock
  - publish / rollback

### `dev.ts` 拆分目标

保留在 `dev.ts` 中：

- `runConfiguredDevServer`
- `runDevCli`
- 顶层 HTTP 分发入口

拆出去：

- `dev-config.ts`
  - `deriveDevRuntimeState`
  - `resolveDevWatchRoots`
- `dev-imports.ts`
  - `resolveBareImportPathForDev`
  - bare import rewrite
- `dev-reload.ts`
  - watch
  - reload hub
  - SSE
- `dev-assets.ts`
  - 静态资源 URL 到物理目录的映射
  - 多目录静态资源读取

## 不拆的模块

这些继续保持现状：

- `assets.ts`
- `finalize-js.ts`
- `finalize-css.ts`
- `bootstrap.ts`
- `report.ts`
- `runtime.ts`

原因：

- 它们已经足够小
- 再拆收益有限

## 必要备选与取舍

### 方案 A：只拆配置解析和发布逻辑

不选。

原因：

- `dev.ts` 的职责混杂问题仍会保留

### 方案 B：中等力度拆分，保留现有 API

主方案。

原因：

- 风险可控
- 收益明显
- 不改对外契约

### 方案 C：大规模 builder 内部重组

不选。

原因：

- 超出当前需求
- 风险过高

## 影响范围

### 代码

- `src/builder/build.ts`
- `src/builder/dev.ts`
- 新增若干 builder 内部模块
- 对应测试中的 import 路径若引用内部实现，需要少量同步

### 文档

- 通常不需要大改 README
- 若 README 中有直接引用内部文件路径的段落，再最小同步

### 测试

- 需要保证现有 builder 测试继续通过
- 若要给拆出去的新模块补 focused tests，可以沿用现有测试风格

## 风险

### 中风险：内部拆分容易引入循环依赖

- 特别是 `build-config` / `build-validate` / `build-publish` 之间
- 需要保持依赖方向单一

### 中风险：拆分后测试 import 路径漂移

- 当前部分测试直接导入 builder 内部模块
- 拆分时要避免一次性大面积打散

## 验证方式

至少覆盖：

1. builder focused tests 继续通过
2. `bun run test`
3. `bun run typecheck`
4. 如有必要，补跑一个真实 builder 消费项目 smoke test

## 回滚方案

若拆分过程中复杂度上升或引入循环依赖：

1. 回退新建的内部模块文件
2. 恢复 `build.ts` / `dev.ts` 的原始组织
3. 恢复被修改的测试 import 路径

## 实施顺序

1. 先拆 `build-config.ts`
2. 再拆 `build-validate.ts`
3. 再拆 `build-publish.ts`
4. 然后拆 `dev-imports.ts`
5. 再拆 `dev-reload.ts`
6. 最后拆 `dev-config.ts` / `dev-assets.ts`
7. 执行全量验证
