# Builder Assets Dirs Design

## 目标

- 将 `builder` 的静态资源配置改为唯一入口 `assetsDirs?: string[]`
- 支持多个静态资源目录按目录名原样暴露
- 让 dev 与 build 对静态资源目录的 URL 语义保持一致
- 补充说明 `builder.ts` 作为唯一配置文件的重要性与默认值语义

## 非目标

- 不合并多个静态资源目录到同一个 `/assets/*` 前缀
- 不引入结构化对象配置
- 不改变 `functions/`、`route`、`ui`、`use` 的运行时契约
- 不引入自动 hash、重写或内联静态资源文件名

## 现状约束

- 当前 `builder` 通过 `builder.ts` 的默认导出对象读取配置
- `builder.ts` 所在目录会被当作项目根目录，`rootDir` 由它自动推导
- 当前静态资源语义固定为单个 `/assets/*`
- 路径穿越、物理路径与符号链接逃逸当前都按“单个根目录”处理
- 当前 README 里的默认值说明还围绕单个 `assetsDir`

## 主方案

新增配置：

```ts
assetsDirs?: string[]
```

### 语义

若配置：

```ts
assetsDirs: ["assets", "public"]
```

则：

- dev 暴露：
  - `/assets/*`
  - `/public/*`
- build 输出：
  - `<outDir>/assets/**`
  - `<outDir>/public/**`

即：

- 每个目录按目录名原样暴露
- 不合并
- 不改名
- 不重写

### 配置入口与默认值

`builder.ts` 仍然是唯一配置入口。

默认值需要在文档里明确说明：

- `appComponent`: `"src/App.svelte"`
- `mountId`: `"app"`
- `appTitle`: `"Svelte Builder"`
- `assetsDirs`: 若未配置则默认尝试 `["assets"]`
- `outDir`: `"dist"`
- `port`: `3000`
- `sourcemap`: `false`
- `stripSvelteDiagnostics`: `true`

其中 `assetsDirs` 的默认值语义是：

- 默认目录名是 `assets`
- 如果项目根下不存在 `assets/`，则视为“当前项目没有静态资源目录”
- 不再存在旧配置 `assetsDir`

### 路径约束

`assetsDirs` 中每一项都必须满足：

- 是字符串
- 解析后位于项目根内
- 是目录
- 目录名唯一
- 不能与输出目录发生非法重叠
- 不允许通过符号链接解析到项目根外

## 实现边界

### `assets.ts`

从“单根目录”工具集改成“多目录归一化 + 单目录复用工具”：

- 新增：
  - `resolveConfiguredAssetsDirs(...)`
  - 返回按目录名索引的已校验静态资源目录集合
- 现有：
  - `resolveAssetPath(...)`
  - `resolvePhysicalAssetPath(...)`
  - `copyConfiguredAssets(...)`
  继续保留，但改为针对单目录项复用

### `build.ts`

- 配置读取只支持 `assetsDirs`
- 归一化后遍历每个静态资源目录
- 每个目录原样复制到 `<outDir>/<dirName>/`

### `dev.ts`

- 不再只 special-case `/assets/`
- 改为根据 URL 第一段路径名匹配对应的静态资源目录
- 例如：
  - `/assets/logo.svg`
  - `/public/banner.png`

### `README`

静态资源章节改成多目录语义，并补充 `builder.ts` 的定位：

- `builder.ts` 是唯一配置文件
- 主文档示例改为 `assetsDirs`
- 移除 `assetsDir`
- `/assets/*` 的单根表述改成“按目录名原样暴露”
- 默认值表需要改成 `assetsDirs`

## 必要备选与取舍

### 方案 A：继续只保留 `assetsDir`

不选。

原因：

- 无法满足多个静态资源目录并存的目标

### 方案 B：`assetsDirs: Array<{ dir, mount }>`

不选。

原因：

- 当前需求已明确采用“目录名即 URL 前缀”
- `string[]` 已足够表达
- 对现阶段属于过度设计

### 方案 C：多个目录仍合并到同一个 `/assets/*`

不选。

原因：

- 会引入覆盖优先级和冲突语义
- 用户已明确不采用这一语义

## 影响范围

### 代码

- `src/builder/assets.ts`
- `src/builder/build.ts`
- `src/builder/dev.ts`
- 相关 builder tests

### 文档

- `src/builder/README.md`
- 如有必要：根 `README.md`
- 如有必要：migration 文档

### 测试

- 现有 `assets.test.ts` 需要覆盖 `assetsDirs`
- 需要新增多目录 dev/build 语义验证

## 风险

### 中风险：配置面切换会影响 dev/build 两条主链

因为 `assetsDirs` 会同时影响：

- dev 静态文件服务
- build 静态文件复制
- watch roots
- README 中的默认值与示例

这不是单点改动，需要成对验证。

### 中风险：这是明确的配置 breaking change

- 旧写法 `assetsDir` 将失效
- 消费方必须迁移到 `assetsDirs`

## 验证方式

至少覆盖：

1. `assetsDirs: ["assets", "public"]` 时，build 会生成：
   - `<outDir>/assets/**`
   - `<outDir>/public/**`
2. dev 可直接访问：
   - `/assets/*`
   - `/public/*`
3. 重复目录名或非法目录时明确失败
4. 旧 `assetsDir` 会被明确拒绝
5. README 能正确说明 `builder.ts` 的唯一配置入口地位和默认值

然后执行：

```bash
bun run test
bun run typecheck
```

## 回滚方案

若多目录方案引入不可接受复杂度，则：

1. 恢复单个 `assetsDir` 配置语义
2. 删除 `assetsDirs`
3. 回退 `README` 与测试到单根目录说明

## 实施顺序

1. 先写多目录失败测试
2. 实现 `assetsDirs` 配置读取与归一化
3. 删除 `assetsDir` 配置入口
4. 实现 build 多目录复制
5. 实现 dev 多目录暴露
6. 更新 README / migration，补 `builder.ts` 重要性和默认值
7. 执行全量验证
