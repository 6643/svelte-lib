# svelte-lib

单 `package.json` 多子路径导出：

- `svelte-lib`
- `svelte-lib/ui`
- `svelte-lib/use`
- `svelte-lib/route`
- `svelte-lib/builder`

其中：

- `ui/` 放可复用 Svelte 组件与图标
- `use/` 放 hooks 与轻量工具
- `route/` 放路由实现，对外通过 `svelte-lib/route` 暴露
- `builder/` 放构建能力，对外通过 `svelte-lib/builder` 暴露

## 安装

作为本地依赖使用时，先在消费项目里安装：

```bash
bun add /._/svelte-lib
bun install
```

## 导入

```ts
import { IconButton } from "svelte-lib/ui";
import { useTheme } from "svelte-lib/use";
import { Route } from "svelte-lib/route";
import { runConfiguredBuild } from "svelte-lib/builder";
```

## CLI

`svelte-lib` 暴露了 `svelte-builder` 这个 bin，但是否自动出现在 `.bin/` 取决于消费项目的安装方式。

在当前本地仓库开发流里，最稳妥的调用方式是直接执行 builder CLI：

```bash
bun /._/svelte-lib/builder/cli.ts build
bun /._/svelte-lib/builder/cli.ts dev
```

如果你的包管理器已经正确把 bin 链接到项目里，也可以直接使用：

```bash
svelte-builder build
svelte-builder dev
```
