# svelte-lib demo

顶层 `demo/` 是一个完整的样例 app，用来演示如何在真实消费项目里组合使用：

- `svelte-lib/ui`
- `svelte-lib/use`
- `svelte-lib/route`
- `svelte-lib/builder`

其中包含：

- 普通同步 route
- `query` decoder
- modal/snippet 组件用法
- 一个通过 `component={() => import(...)}`
  实现的懒加载 route demo

它不是额外的包导出路径，不能通过 `svelte-lib/demo` 导入。

## 安装

在仓库根目录下：

```bash
cd demo
bun install
```

这会把上一级仓库作为本地依赖安装进来：

- `svelte-lib: file:..`
- `svelte: latest`

## 运行

```bash
cd demo
bun run dev
```

当前脚本通过本地 bin 启动：

- `svelte-dev`

默认监听端口见 [`builder.ts`](./builder.ts)。

## 构建

```bash
cd demo
bun run build
```

当前脚本通过本地 bin 启动：

- `svelte-build`

构建产物会输出到 `demo/dist/`，该目录已在仓库 `.gitignore` 中忽略。

## 类型检查

```bash
cd demo
bun run typecheck
```

这会使用 [`tsconfig.json`](./tsconfig.json) 执行 `svelte-check`。

## 结构

```text
demo/
  README.md
  package.json
  tsconfig.json
  builder.ts
  src/
    App.svelte
    routes/
  assets/
```

其中：

- [`package.json`](./package.json) 定义 demo 自己的脚本与依赖
- [`builder.ts`](./builder.ts) 定义样例 app 的 builder 配置
- [`src/App.svelte`](./src/App.svelte) 负责样例首页与导航
- `src/routes/*` 演示 route、query decoder、modal 和主题切换的组合用法
- `src/routes/LazyProfile.svelte` 演示 route 级别的按需加载
