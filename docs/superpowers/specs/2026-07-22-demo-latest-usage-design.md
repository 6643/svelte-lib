# Demo Latest Usage Design

## Goal

让 `/home/_/._/svelte-lib/demo` 作为真实 `svelte-lib` consumer 对齐当前 Bun、Svelte 5 和 builder 的公开用法, 不改变根包 API, 不引入 Vite。

## Current Evidence

- `Counter.svelte` 已使用 Svelte 5 `$state` 和事件属性 `onclick`。
- `builder.ts` 仍使用无运行时行为的 `defineSvelteConfig` 包装器, 而 builder 文档示例使用默认导出对象。
- `App.svelte` 自己声明 `<main id="app">`, 与 builder 自动生成的 shell 根容器重复。
- demo 文案仍使用旧的 `svelte-builder` 名称。
- demo 缺少显式的 typecheck 脚本和 consumer 侧的 Svelte peer 依赖声明。

## Design

### Builder configuration

`demo/builder.ts` 直接默认导出严格配置对象。字段保持现有语义: `appComponent`、`appTitle`、`mountId`、`assetsDirs`、`outDir` 和 `port` 不变; 只移除不必要的 helper 调用。

### App root ownership

builder 负责生成 `<main id="app">` 并把根组件 mount 到其中。`demo/src/App.svelte` 改为返回普通内容 section, 不再声明同名 id, 由 builder 单点拥有 mount root。

### Consumer package

demo 显式声明 `svelte` peer 的实际 consumer 依赖, 并增加 `check` 脚本以及 `svelte-check`/`typescript` 开发依赖。现有 `build` 和 `dev` 脚本保留并继续使用 `svelte-build`/`svelte-dev`。

### Scope

保留 `Counter.svelte` 现有 runes-first 实现, 不重做视觉设计, 不修改 `src/builder` 的公开接口, 不生成或提交 demo 的安装锁文件。

## Verification

- `bun test --conditions=browser tests/demo-latest-usage.test.ts`
- `bun x svelte-check --tsconfig ./tsconfig.json` in `demo/`
- `bun run build` in `demo/`
- start `bun run dev` in `demo/`, verify `/` and `/main.ts`, then stop the server
- `bun run test`
- `git diff --check`
