# Native Bun HMR Design

## Goal

验证并在可行时接入 Bun 官方 fullstack frontend server 的 HMR 能力, 同时保留当前 builder 的配置、安全、静态资源和错误响应契约。consumer 项目的 `bunfig.toml` 不得被修改, 不引入 Vite 或 Rollup。

## Scope

本阶段只处理 builder dev pipeline。`src/route` 已有独立 runtime, 不在本阶段重写。生产 `Bun.build({ plugins })` 路径保持不变。

## Design

### Isolated workspace

`serve()` 启动时在系统临时目录创建一个只包含内部入口的 workspace。已通过 app source-root 校验的目录以 symlink 挂入 workspace; child 使用 `--config=<workspace>/bunfig.toml` 并以 consumer root 作为 cwd, 让 Bun 观察到真实 source 变更:

- `index.html`: 官方 fullstack route 的入口页面。
- `main.ts`: 由 builder 生成的 app bootstrap, 只导入经过 root policy 校验的 app component。
- `bunfig.toml`: 只在该临时 workspace 中注册共享 Svelte plugin 和 runtime alias plugin。
- `server.ts`: 以 `development: { hmr: true }` 启动 Bun fullstack server, 只提供生成的 HTML route、受控静态资源和 HMR 资源。
- `app/`: 指向已校验 source root 的 symlink, 不复制 consumer 源码。仅改变 symlink 或以 workspace cwd 启动不足以触发 Bun 1.3.14 的外部 source watcher, consumer root cwd 是必要条件。

workspace 由 builder 负责生成和清理, consumer 项目目录不写入任何配置或 shim 文件。

### Runtime configuration lifecycle

native parent watcher 观察 `builder.ts` 和当前已解析的 assets roots。配置或 assets root 拓扑变化时, parent 重新加载并校验配置, 只有运行时状态真正变化才重建 workspace 和 child; 以第一次绑定后的实际端口重启, 保持返回给 caller 的端口稳定。无效配置保留当前可用 child, `port` 变化要求用户重启 `svelte-dev`, 避免静默改变 server handle 的端口语义。

组件更新由生成的 bootstrap 通过 `import.meta.hot.accept` 接收, 先卸载旧组件再挂载新组件。这样 CSS 和根组件更新不触发 document reload, 但组件局部状态会重置; 该适配器不宣称通用 state-preserving Svelte HMR。

### Policy boundary

生成 server 接收已经解析和校验过的 consumer root、app component、assets 和 mount 配置。runtime alias 从 consumer root 查找 peer `svelte` 包, 不绑定 builder 自己的依赖。server 只允许:

- `/` 和 Bun fullstack 生成的 app assets;
- `/main.ts`、已通过 app source root 校验的本地 source requests 和 package-bounded `/_node_modules/*` requests;
- 配置的静态资源目录;
- Bun 自己的 HMR transport。

所有其它请求返回 404, 编译和 server 错误对浏览器返回通用 500。若 native server 无法可靠维持这些边界, native 模式不切换为默认路径。

### Capability gate

native path 只有在真实浏览器测试同时观察到以下结果时才可启用:

1. HTML route 和 generated JavaScript 返回 200。
2. Svelte plugin 编译 `.svelte` 与 rune module, CSS 能更新。
3. HMR transport 建立, source/module edit 不触发 `location.reload()`。
4. 一个 self-accepting module 在不刷新页面的情况下更新可观察 DOM。
5. CSS edit 通过 bootstrap accept/remount 在不刷新 document 的情况下更新 style。
6. module route 的编译错误返回通用 500, 文件恢复后模块再次成功编译; Bun 官方 page overlay 保留其 development 诊断显示语义。

如果第 3 或 4 项失败, 结果记录为 Bun HMR capability 未达标, `svelte-dev` 继续使用现有 SSE full-page reload fallback。第 5 项允许组件 remount, 不把它记为 state-preserving HMR。

## Error and lifecycle handling

- workspace 创建失败、server 未在启动窗口内报告 ready 返回 `Result` 错误; 已启动 child 的自然退出由 parent supervisor 观察, 按实际端口串行重启, 连续失败达到上限后停止自动重启。
- native child 启动失败时 `serve()` 回退到现有 custom `Bun.serve` + SSE full-page reload server。
- `stop()` 必须先关闭 HMR/server child, 等待其退出, 再清理 workspace。
- 已关闭 server 不得响应新的 watcher/config task。
- 任一 compiler failure 不得产生未处理 Promise rejection。
- 主动 `stop()` 和配置重建会登记 expected exit, 不得被 supervisor 当作异常退出再次重启; native runtime restart 失败时尝试恢复旧配置的 child; watcher task 必须串行等待并可在 `stop()` 中收敛。
- 自然退出自动重启最多连续执行 3 次; child 稳定运行 1 秒或成功的配置重建后清零计数, 防止持续失败形成无限重启。

## Verification

- Bun test: generated workspace manifest, server lifecycle, source-root and assets policy.
- Browser gate: initial render, self-accepting module HMR, bootstrap component remount/CSS update and console errors. Bun tests cover module-route compiler error responses and recovery; the official development overlay is not treated as a stable DOM contract.
- Existing builder, route and package policy tests remain green.

## Gate Result

在 Bun `1.3.14` 上, 初始 HTML、self-accepting module HMR、bootstrap component remount/CSS 更新、module route 编译错误响应与恢复、路径/asset policy、配置变更重建、自然退出生命周期契约和 consumer `bunfig.toml` 不写入均已通过 fixture/测试验证; browser gate 额外确认 module/CSS 更新没有 document reload 且 console 无错误。native server 已接入 `svelte-dev` 默认路径, 启动失败仍回退 SSE。Bun 官方 development overlay 可能显示或保留编译诊断, 这是本地 dev 限制, 不是生产错误响应契约。

## Non-goals

- 不复制 Bun 私有 HMR runtime。
- 不宣称所有 Svelte component state 都能自动保留, 除非浏览器测试直接证明。
- 不修改 consumer `bunfig.toml`。
- 不新增通用 dev proxy 或 polling watcher。
