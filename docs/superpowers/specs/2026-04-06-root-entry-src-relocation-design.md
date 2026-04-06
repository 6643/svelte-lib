# Root Entry `_.ts` Relocation Design

## 背景

上一轮目录重组已经把 `ui`、`use`、`route`、`builder` 四块源码统一收进顶层 `src/`，但根包聚合入口 `_.ts` 仍留在仓库根目录：

- 当前物理位置：`/._/svelte-lib/_.ts`
- 当前包入口映射：
  - `package.json#module -> ./_.ts`
  - `package.json#exports["."] -> ./_.ts`

这导致根目录仍然保留一个发布源码入口，和“顶层源码统一收进 `src/`”这一目标不完全一致。

## 目标

1. 把根包聚合入口从仓库根移动到 `src/_.ts`
2. 保持公开导入方式不变：
   - `import "svelte-lib"`
3. 保持当前子路径导出不变：
   - `svelte-lib/ui`
   - `svelte-lib/use`
   - `svelte-lib/route`
   - `svelte-lib/builder`
4. 继续保持单包仓库形态，不引入额外包层级或兼容垫片

## 非目标

1. 不调整根包对外导出内容集合
2. 不新增 root `_.ts` shim 转发文件
3. 不调整 `src/ui`、`src/use`、`src/route`、`src/builder` 的内部实现
4. 不修改 demo 的公开使用方式

## 已确认约束

### 公开契约

- 根 `.` 入口当前由 `package.json` 的 `module` 与 `exports["."]` 指向 `./_.ts`
- 对外使用者只关心 `svelte-lib` 这一公开包入口，不应感知物理路径变化

### 仓库内依赖

当前仓库内已知直接依赖 root `_.ts` 物理路径的地方包括：

- `tests/package-exports.test.ts`
- `tests/package-policy.test.ts`

另外，`src/route/tests/*` 和其他子路径测试依赖的是各自目录内的 `../_.ts`，不依赖仓库根 `_.ts`，因此不应被这次迁移误改。

## 选定方案

采用“根入口物理迁移 + 包入口指针同步切换”方案：

```text
src/
  _.ts
  ui/
  use/
  route/
  builder/
package.json
```

具体动作：

1. 删除仓库根 `_.ts`
2. 新增 `src/_.ts`
3. 将 `package.json#module` 从 `./_.ts` 改为 `./src/_.ts`
4. 将 `package.json#exports["."]` 从 `./_.ts` 改为 `./src/_.ts`
5. 更新仓库测试里对 root 物理入口的断言与导入

## 备选方案与取舍

### 方案 A：保留 root `_.ts`，新增 `src/_.ts`，让 root 文件仅做转发

优点：

- 对仓库内旧物理路径引用更宽容

不选理由：

- 根目录仍保留发布源码入口，和“源码统一收进 `src/`”目标冲突
- 会形成两层语义等价入口，增加维护歧义

### 方案 B：维持现状

不选理由：

- 无法完成这次明确目标

## 影响范围

### 需要同步更新

1. `package.json`
2. 仓库根 `_.ts` 与新 `src/_.ts`
3. `tests/package-exports.test.ts`
4. `tests/package-policy.test.ts`
5. 任何仍直接写死 root `_.ts` 物理路径的位置

### 不应改变

1. `import "svelte-lib"` 的公开使用方式
2. `svelte-lib/ui`、`svelte-lib/use`、`svelte-lib/route`、`svelte-lib/builder`
3. `src/route/tests/*` 这类依赖各自目录 `../_.ts` 的子路径测试

## 风险

### 中风险：根包入口映射失效

若 `package.json#module` 或 `exports["."]` 未同步切换，会导致根包入口失效。

缓解：

- 先写测试锁定 `./src/_.ts` 预期
- 修改后先跑包契约定向测试

### 低风险：误改子路径测试入口

若批量搜索替换不够精确，可能误把 `src/route/tests/public-api.test.ts` 这类本地 `../_.ts` 改坏。

缓解：

- 只改明确依赖仓库根 `_.ts` 的测试
- 跑全量测试确认未波及子路径入口

## 验证策略

至少验证：

1. `bun test tests/package-exports.test.ts tests/package-policy.test.ts`
2. `bun run test`
3. `bun run typecheck`
4. `bun run --cwd demo build`

并追加扫描：

5. 搜索仓库内是否仍有对 root `_.ts` 的旧物理直链

## 回滚

若迁移后验证失败，按以下步骤回滚：

1. 把 `src/_.ts` 移回仓库根恢复为 `_.ts`
2. 恢复 `package.json#module` 与 `exports["."]` 为 `./_.ts`
3. 恢复相关测试中的 root 入口断言与导入

由于公开导入名 `svelte-lib` 不变，回滚重点仍是仓库内部物理路径与包入口指针恢复。

## 实施建议

建议顺序：

1. 先改测试，把 `./src/_.ts` 预期锁定为红灯
2. 再迁移 `_.ts` 到 `src/_.ts`
3. 同步修改 `package.json`
4. 先跑定向测试，再跑全量验证

不要把这次根入口迁移和其他导出调整混在一起提交。
