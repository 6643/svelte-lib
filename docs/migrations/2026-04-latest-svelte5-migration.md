# Latest + Svelte 5 Migration

这份仓库现在按“内部协同升级”策略维护：

- `devDependencies` 使用 `latest`
- `peerDependencies` 也使用 `latest`
- UI 组件默认按当前 Svelte 5 runes-first 写法维护

当前维护中的 UI 组件内部基线为：

- 使用 `$props` / `$state` / `$derived` / `$effect`
- 不再保留 `export let`
- 不再保留 `$:`

这意味着：

- 上游依赖升级会更快进入仓库
- 外部消费方如果还保留旧写法, 需要跟着迁移
- 每次升级依赖后都应重新执行一次完整验证

## 验证基线

建议至少执行：

```bash
bun test
bun run typecheck
```

如果你在真实项目里消费 `svelte-lib/builder`, 还应额外执行：

```bash
svelte-build
```

## Breaking Changes

### 1. builder CLI 从 `svelte-builder` 拆分为 `svelte-build` / `svelte-dev`

旧写法：

```bash
svelte-builder build
svelte-builder dev
```

新写法：

```bash
svelte-build
svelte-dev
```

说明：

- `svelte-builder build` 不再可用
- `svelte-builder dev` 不再可用
- 仓库根目录也不再提供 `builder:build` / `builder:dev` 脚本，因为根仓库本身不是 builder app

### 2. builder 不再内置 `/items` 与 `/cron` 的 dev 代理

旧行为：

- 设置 `PAGES_PROXY_URL` 后，`svelte-dev` 会代理 `/items`、`/items/*`、`/cron` 和 `/cron/*`

新行为：

- `PAGES_PROXY_URL` 不再生效
- `svelte-dev` 只负责本地 app 源码、`/_node_modules/*` 与 `/assets/*` 的服务
- 如果项目需要代理后端接口，应由项目自身的 dev 环境提供

### 3. builder 不再支持 app-local `package.json#imports` 与 watcher polling fallback

旧行为：

- app 自己的 `package.json#imports` 会被 `builder` 特别解析
- `fs.watch` 失败时，`svelte-dev` 会自动降级到 polling fallback

新行为：

- `builder` 只支持相对导入、普通 bare import，以及 `svelte` 运行时 alias
- app 自己的 `package.json#imports` 不再受支持
- `fs.watch` 失败时会直接输出 watcher 错误，不再自动轮询

### 4. `route` 不再导出 `lazyRoute`

旧写法：

```svelte
<script lang="ts">
  import { Route, lazyRoute } from "svelte-lib/route";
</script>

<Route path="/settings" component={lazyRoute(() => import("./Settings.svelte"))} />
```

新写法：

```svelte
<script lang="ts">
  import { Route } from "svelte-lib/route";
</script>

<Route path="/settings" component={() => import("./Settings.svelte")} />
```

### 5. `routeForwardPath` 已移除，来源感知收缩为 router-managed only

旧写法：

```ts
import {
  routeBackPath,
  routeCurrentPath,
  routeForwardPath
} from "svelte-lib/route";
```

新写法：

```ts
import {
  routeBackPath,
  routeCurrentPath
} from "svelte-lib/route";
```

说明：

- `routeForwardPath` 不再导出
- `routeBackPath()` 仍保留，但只对 `routePush()` / `routeReplace()` 形成的 router-managed 导航链路保证准确
- 外部代码直接调用原生 `history.pushState()` / `history.replaceState()` 时，不再承诺同步 router 辅助状态

### 6. 多个 UI 组件从 slot API 收敛到 snippet prop API

受影响组件：

- `Block`
- `StringInput`
- `RangeInput`
- `FilledModal`
- `Swiper`

#### `Block`

旧写法：

```svelte
<Block headerTitle="Title" footerLeft="Left">
  <div slot="headerActions">Actions</div>
  <div>Body</div>
  <div slot="footerRight">More</div>
</Block>
```

新写法：

```svelte
<Block headerTitle="Title" footerLeft="Left">
  {#snippet headerActions()}
    <div>Actions</div>
  {/snippet}

  {#snippet children()}
    <div>Body</div>
  {/snippet}

  {#snippet footerRight()}
    <div>More</div>
  {/snippet}
</Block>
```

#### `StringInput` / `RangeInput`

旧写法：

```svelte
<StringInput>
  <Icon slot="left" />
  <Button slot="right" />
</StringInput>
```

新写法：

```svelte
<StringInput>
  {#snippet left()}
    <Icon />
  {/snippet}

  {#snippet right()}
    <Button />
  {/snippet}
</StringInput>
```

`RangeInput` 同理。

#### `FilledModal`

旧写法：

```svelte
<FilledModal>
  <div>Modal Content</div>
</FilledModal>
```

新写法：

```svelte
<FilledModal>
  {#snippet children()}
    <div>Modal Content</div>
  {/snippet}
</FilledModal>
```

#### `Swiper`

旧写法：

```svelte
<Swiper>
  <swiper-slide>Slide A</swiper-slide>
</Swiper>
```

新写法：

```svelte
<Swiper>
  {#snippet children()}
    <swiper-slide>Slide A</swiper-slide>
  {/snippet}
</Swiper>
```

### 3. 组件内部事件处理从 `on:` 收敛到事件属性

受影响组件：

- `FilledButton`
- `IconButton`
- `TextButton`
- `StringInput`
- `RangeInput`
- `FilledModal`
- `Plyr`

旧写法：

```svelte
<button on:click={handleClick}>Save</button>
<input on:input={handleInput} />
<dialog on:cancel={handleCancel} on:click={handleBackdropClick} />
```

新写法：

```svelte
<button onclick={handleClick}>Save</button>
<input oninput={handleInput} />
<dialog oncancel={handleCancel} onclick={handleBackdropClick} />
```

### 4. `builder.ts` 是执行式配置

`builder.ts` 会作为模块直接执行，而不是被当成纯 JSON 配置读取。

这意味着：

- 不要在不可信项目里直接运行
- 顶层代码会执行
- 构建前应把它当作“代码”而不是“配置”

## 推荐迁移顺序

1. 先替换 `lazyRoute(...)`
2. 再替换 UI 组件里的旧 slot 写法为 snippet props
3. 再把内部 `on:` 事件指令切到事件属性
4. 跑 `bun test`
5. 跑 `bun run typecheck`
6. 如使用 builder，再在真实项目里跑一次 `svelte-build`
