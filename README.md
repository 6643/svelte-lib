# svelte-lib

单 `package.json` 多子路径导出：

- `svelte-lib`
- `svelte-lib/ui`
- `svelte-lib/use`
- `svelte-lib/route`
- `svelte-lib/builder`

其中：

- `src/ui/` 放可复用 Svelte 组件与图标
- `src/use/` 放 hooks 与轻量工具
- `src/route/` 放路由实现，对外通过 `svelte-lib/route` 暴露
- `src/builder/` 放构建能力，对外通过 `svelte-lib/builder` 暴露

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

## Svelte 5 用法

组合型 UI 组件现在默认按 snippet prop API 使用，组件内部统一按 runes-first 风格维护：

- `$props`
- `$state`
- `$derived`
- `$effect`

已维护的 UI 组件不再保留 `export let` 和 `$:` 这类旧语法。

示例：

```svelte
<script lang="ts">
  import { Block, FilledModal, StringInput } from "svelte-lib/ui";
</script>

<Block headerTitle="Profile" footerLeft="Tips">
  {#snippet headerActions()}
    <button type="button">Save</button>
  {/snippet}

  {#snippet children()}
    <StringInput label="Name" value="Ada">
      {#snippet left()}
        <span>@</span>
      {/snippet}
    </StringInput>
  {/snippet}
</Block>

<FilledModal active={true}>
  {#snippet children()}
    <div>Modal Content</div>
  {/snippet}
</FilledModal>
```

组件内部事件处理也统一使用当前 Svelte 5 推荐的事件属性写法，例如 `onclick={handleClick}`、`oninput={handleInput}`。

## 命令行

`svelte-lib` 现在暴露两个独立可执行入口：`svelte-build` 和 `svelte-dev`。它们是否自动出现在 `.bin/` 取决于消费项目的安装方式。

在真实 builder 项目里，最稳妥的调用方式是直接执行构建器命令行入口：

```bash
bun /._/svelte-lib/src/builder/build.ts
bun /._/svelte-lib/src/builder/dev.ts
```

当前源码仓库本身不是一个 builder app，根目录没有 `builder.ts`，因此不再提供 `builder:build` / `builder:dev` 根脚本。

如果你的包管理器已经正确把 bin 链接到项目里，也可以直接使用：

```bash
svelte-build
svelte-dev
```
