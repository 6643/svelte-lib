# Latest + Svelte 5 Migration

这份仓库现在按“内部协同升级”策略维护：

- `devDependencies` 使用 `latest`
- `peerDependencies` 也使用 `latest`
- UI 组件默认按当前 Svelte 5 写法维护

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
svelte-builder build
```

## Breaking Changes

### 1. `route` 不再导出 `lazyRoute`

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

### 2. 多个 UI 组件从 slot API 收敛到 snippet prop API

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
6. 如使用 builder，再在真实项目里跑一次 `svelte-builder build`
