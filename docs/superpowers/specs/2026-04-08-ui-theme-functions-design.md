# UI Theme Functions Design

## 目标

- 删除 `src/use/useTheme.ts`
- 在 `src/ui` 提供两个公开主题函数：
  - `setLightTheme()`
  - `setDarkTheme()`
- 主题切换只通过 CSS 变量完成
- 不使用 class，也不使用根节点 attribute

## 非目标

- 不保留 `useTheme`
- 不做 `localStorage` 持久化
- 不做 `prefers-color-scheme`
- 不做 `toggleTheme`
- 不做局部元素级主题覆盖
- 不引入新的主题状态 store

## 现状约束

- UI 组件当前已经依赖 CSS 变量，例如：
  - `--theme-color`
  - `--sf-color`
  - `--sb-color`
  - `--pf-color`
- 当前仓库没有统一的 light/dark token 写入入口。
- 现有主题能力位于 `src/use/useTheme.ts`，它同时承担状态、初始化和 DOM side effect。
- 当前方向要求库能力更小、更干净，因此不再保留 `useTheme` 这类状态型主题 hook。

## 主方案

新增 `src/ui/theme.ts`，作为最小主题副作用入口。

### 公开 API

- `setLightTheme(): void`
- `setDarkTheme(): void`

### 行为

- 两个函数都只操作 `document.documentElement.style`
- 它们通过 `style.setProperty(...)` 写入固定 CSS 变量
- 非浏览器环境下直接 no-op

### 初始 token 范围

首批固定写入以下变量：

- `--theme-color`
- `--sf-color`
- `--sb-color`
- `--pf-color`

这些变量已经被现有 UI 组件消费，足以覆盖当前公开组件的主题色需求。

### 模块调整

- `src/ui/_.ts`
  - 新增导出 `setLightTheme` / `setDarkTheme`
- `src/use/_.ts`
  - 移除 `useTheme` 导出
- 删除：
  - `src/use/useTheme.ts`
  - `src/use/useTheme.test.ts`

## 必要备选与取舍

### 方案 A：保留 `useTheme`，仅改内部实现

不选。

原因：

- 与“删除 `useTheme`”冲突
- 仍然保留状态与初始化逻辑
- 不符合当前“最小最干净”的目标

### 方案 B：增加 `toggleTheme()`

不选。

原因：

- 不是当前必需能力
- 容易把最小 API 再扩回状态型入口

### 方案 C：支持传入任意元素做局部主题覆盖

不选。

原因：

- 超出最小实现
- 当前仓库没有 scoped theme 的既有模式

## 影响范围

### 代码

- `src/ui/theme.ts` 新增
- `src/ui/_.ts` 修改
- `src/use/_.ts` 修改
- `src/use/useTheme.ts` 删除
- `src/use/useTheme.test.ts` 删除

### 文档

- 根 README 中的主题说明若涉及 `useTheme`，需要改到 `ui` 主题函数

### 测试

- 新增 `ui` 主题函数测试
- 删除 `useTheme` 测试
- 若有仓库策略测试显式引用 `useTheme`，需同步更新

## 风险

### 中风险：主题 token 被库内置

删除 `useTheme` 后，库开始拥有一套固定 light/dark token。

影响：

- 消费方自定义主题空间缩小
- 后续若要引入第三套主题，会需要扩 API 或改 token 结构

当前接受理由：

- 这是用户明确要求的最小方案
- 当前仓库尚无更成熟的主题系统

### 低风险：刷新后主题不会保留

因为不做持久化，刷新后不会自动恢复上一次选择。

当前接受理由：

- 用户已明确认为持久化不是必要能力

## 验证方式

新增主题函数测试，至少覆盖：

1. `setLightTheme()` 会写入预期变量
2. `setDarkTheme()` 会覆盖为另一套变量
3. 非浏览器环境调用不会抛错

然后执行：

```bash
bun run test
bun run typecheck
```

## 回滚方案

若新主题函数方案不满足预期，则：

1. 恢复 `src/use/useTheme.ts`
2. 恢复 `src/use/useTheme.test.ts`
3. 在 `src/use/_.ts` 恢复 `useTheme` 导出
4. 删除 `src/ui/theme.ts`
5. 在 `src/ui/_.ts` 移除 `setLightTheme` / `setDarkTheme`

## 实施顺序

1. 先写 `src/ui/theme` 失败测试
2. 实现 `setLightTheme()` / `setDarkTheme()`
3. 调整 `ui` 与 `use` barrel 导出
4. 删除 `useTheme` 及其测试
5. 更新 README / 策略测试
6. 执行全量验证
