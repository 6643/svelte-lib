# Root `src/` Layout Reorganization Design

## 背景

当前仓库是单包、多公开子路径结构，主要能力直接位于仓库根目录：

- `ui/`
- `use/`
- `route/`
- `builder/`

这四个目录同时承担了两层语义：

1. 它们是仓库中的物理源码目录
2. 它们对应根包对外暴露的公开子路径：
   - `svelte-lib/ui`
   - `svelte-lib/use`
   - `svelte-lib/route`
   - `svelte-lib/builder`

随着 demo、tests、docs 等目录逐步完善，仓库根目录已经同时承载：

- 发布包源码
- 顶层 demo app
- 仓库级测试
- 历史设计与迁移文档

用户希望把根目录看起来更清爽，但不希望因此把仓库改造成 monorepo，也不希望破坏当前稳定的公开导入路径。

## 目标

1. 把 `ui`、`use`、`route`、`builder` 四块能力统一收进顶层 `src/`
2. 保持公开导入路径不变：
   - `svelte-lib/ui`
   - `svelte-lib/use`
   - `svelte-lib/route`
   - `svelte-lib/builder`
3. 继续保持单包仓库形态，不引入 workspace / 多项目发布结构
4. 让仓库根目录主要保留“入口、文档、测试、demo”这些更高层级的内容

## 非目标

1. 不拆分为 4 个独立项目
2. 不引入 `packages/`、workspace、子包 `package.json`
3. 不改变 npm 包名 `svelte-lib`
4. 不改变已有公开子路径名
5. 不借机重写 `ui` / `use` / `route` / `builder` 的内部实现

## 已确认约束

### 公开契约

- 根 [`package.json`](/._/svelte-lib/package.json) 当前通过 `exports` 暴露 `.`, `./ui`, `./use`, `./route`, `./builder`
- `bin` 当前指向 `builder/build.ts` 与 `builder/dev.ts`
- demo 和 README 当前都按 `svelte-lib/ui` 这类公开导入消费库能力

### 仓库内路径依赖

当前仓库内存在大量直接依赖物理路径的地方：

- 根测试里的相对导入与路径断言
- README / migration / builder 文档中的 repo 内部路径
- demo README 中的本地 bin / builder 说明
- 可能存在的本地消费工程对 `/._/svelte-lib/builder/...` 这类路径的直接引用

### `demo/src` 不冲突

顶层 `src/` 代表的是**根包源码根**；`demo/src` 代表的是**demo app 自己的源码根**。二者分别属于不同项目边界，语义不冲突。

## 选定方案

采用“单包内根源码树收拢”方案：

```text
src/
  ui/
  use/
  route/
  builder/
demo/
  src/
docs/
tests/
README.md
_.ts
package.json
```

其中：

- `src/ui/` 对应当前 `ui/`
- `src/use/` 对应当前 `use/`
- `src/route/` 对应当前 `route/`
- `src/builder/` 对应当前 `builder/`

对外公开子路径仍保持不变，只通过 `exports` 重新指向新的物理位置。

## `package.json` 调整原则

### `exports`

从：

- `./ui -> ./ui/_.ts`
- `./use -> ./use/_.ts`
- `./route -> ./route/_.ts`
- `./builder -> ./builder/_.ts`

调整为：

- `./ui -> ./src/ui/_.ts`
- `./use -> ./src/use/_.ts`
- `./route -> ./src/route/_.ts`
- `./builder -> ./src/builder/_.ts`

### `bin`

从：

- `./builder/build.ts`
- `./builder/dev.ts`

调整为：

- `./src/builder/build.ts`
- `./src/builder/dev.ts`

## 影响范围

### 需要同步更新

1. 根包 `exports` / `bin`
2. 根测试中的物理路径断言与相对导入
3. 顶层 README 对仓库内部路径的说明
4. `builder/README` 与迁移文档里的 repo 内部路径
5. `demo` 里任何直接提到 repo 内部文件路径的位置
6. 根 [`_.ts`](/._/svelte-lib/_.ts) 与各公开子路径入口文件之间的相对导入

### 不应改变

1. `import "svelte-lib/ui"` 等公开导入
2. `demo` 作为独立样例 app 的定位
3. `tests/` 作为仓库级测试目录的角色
4. `docs/` 作为历史设计/迁移文档目录的角色

## 备选方案与取舍

### 方案 A：`mods/`

优点：

- 根目录也会明显更清爽
- 比 `packages/` 更不容易被理解成 monorepo

不选理由：

- 这四块本来就是当前包的主要源码，不是“附属模块集合”
- `src/` 更符合“单包源码根”的常见认知

### 方案 B：`lib/`

不选理由：

- 更像内部实现目录，不够贴近“这是整个包的源码根”

### 方案 C：拆成 4 个不同项目

不选理由：

- 当前没有独立发布、独立版本、独立维护者的强约束
- 会立刻引入 workspace、版本同步、CI、文档、联调复杂度
- 解决的是组织形态问题，不是当前主要诉求“根目录观感与层次感”

## 风险

### 中风险：仓库内直链路径失效

任何直接写死 `/._/svelte-lib/builder/...`、`../ui/...` 这类 repo 内部路径的地方都会失效。

缓解：

- 搜索所有 repo 内部物理路径引用并一并改掉
- 文档同步收口
- 保留公开子路径导入不变

### 中风险：相对导入批量调整易漏

四块能力整体搬迁会触发较多相对路径修改。

缓解：

- 按模块批次搬迁并逐批验证
- 每完成一块后跑定向测试
- 最后再跑全量测试与 typecheck

### 低风险：demo/build 脚本说明失真

demo 和 builder 文档里都存在本地直接执行 repo 内部入口的说明。

缓解：

- 搬迁时同步重写这些路径

## 验证策略

目录重组后至少应验证：

1. `bun run test`
2. `bun run typecheck`
3. `bun run --cwd demo build`
4. `bun run --cwd demo dev`

并建议追加：

5. 搜索仓库内残留旧物理路径引用
6. 重新确认 `package.json` 的 `exports` 与 `bin`
7. 如有本地消费工程，再补跑一次它们的 `build` / `dev`

## 回滚

这次重组的回滚应按“目录恢复 + 指针恢复”执行：

1. 把 `src/ui`、`src/use`、`src/route`、`src/builder` 恢复回根目录
2. 恢复 `package.json` 中 `exports` / `bin` 的原始路径
3. 恢复 README / docs / tests 中的旧物理路径

因为公开导入路径不变，所以回滚重点在仓库内部路径，不在外部 API。

## 实施建议

实施顺序建议是：

1. 先改 `package.json` 与入口指向
2. 再迁移四块源码目录
3. 再修根测试和文档
4. 最后跑 demo 与全量验证

不要把这次目录重组和其他运行时重构混在一起提交。
