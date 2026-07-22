# svelte-builder

面向 Bun 与 Svelte 5 的最小生产构建预设。

当前仓库本身就是发布包源码仓库, 不是 monorepo 内的子包。README 中的路径、命令和配置说明都以仓库根目录为准。

它保留独立项目形态, 包含 `src/`、若干静态资源目录和 `builder.ts`。入口由构建器根据 `appComponent` 自动生成, 不再需要手写 `main.ts`。

统一配置文件名是 `builder.ts`。

配置只通过 `builder.ts` 的默认导出提供。

配置文件采用严格字段校验:

- 未知顶层字段会直接报错, 避免拼写错误静默回退到默认值
- `rootDir` 由配置文件所在目录自动推导

这个构建器只支持 SPA：

- 固定 SPA 入口由 `appComponent` 指定, 默认 `src/App.svelte`
- 不支持多页面
- `appComponent` 默认 `src/App.svelte`
- `appComponent` 必须位于 `src/` 或其他顶级源码目录下, 不支持直接把组件放在项目根目录
- 配置文件所在目录会自动作为项目根, `rootDir` 是内部推导值, 不需要手填

HTML 一律使用内置页面壳：

- build/dev 都不读取 `src/index.html`
- 默认根容器固定为 `<main id="app"></main>`
- 默认标题固定为 `Svelte Builder`

dev 源码边界：

- 这里的“app 源码树”指 `appComponent` 归属的 `src/` 或其他顶级源码目录
- dev 只直接暴露 app 源码树里的 `.ts`、`.js`、`.mjs`、`.svelte` 模块, 不直接暴露项目根上的 `builder.ts`、测试文件或其他脚本
- 若 `appComponent` 位于 `src/` 下的更深层目录, dev 仍会回收到 `src/` 作为 app 源码树和 watch 根
- 若 `appComponent` 位于其他顶级源码目录, dev 会以该顶级目录作为 app 源码树和 watch 根
- `appComponent` 若是符号链接, 它解析后的目标仍必须留在对应的 app 源码树内
- 本地源码导入必须留在 app 源码树内, 且当前只支持上述 `.ts`、`.js`、`.mjs`、`.svelte` 模块; 不支持 `file://`、绝对文件路径、其他本地源码扩展或 `import(expr)` 这类无法静态校验的直接文件导入

编译器、运行时与 Bun plugin:

- `svelte-lib/builder` 提供共享的 `createSvelteBunPlugin` 和 `createMountTargetPlugin`; 前者通过 Bun bundler 的 `onLoad` 编译 `.svelte`、`.svelte.ts` 和 `.svelte.js`, 后者为 `svelte-lib/runtime` 注入当前 builder 配置的 `mountId`
- `svelte-lib/runtime` 提供 `mountId` 和 `getMountTarget(scope?)`; builder 的 build/dev/native pipeline 会自动把 `mountId` 注入该 runtime module, 自定义 `Bun.build` pipeline 需要显式加入 `createMountTargetPlugin(mountId)`
- `svelte-build` 使用 `Bun.build({ plugins })` 完成生产编译, CSS 仍由 builder 收集、压缩并写入 hash 文件
- `svelte-dev` 默认启动 Bun 官方 fullstack dev server; `/main.ts`、plugin shim 和 `bunfig.toml` 只写入系统临时 workspace, child 以 consumer 项目根作为 watcher cwd, 不修改 consumer 的 `bunfig.toml`
- native server 通过 `Bun.serve({ development: { hmr: true } })` 提供官方 HMR, 同时保留受控的 `/main.ts`、app source、`/_node_modules/*` 和静态资源路由; native child 启动失败时回退到现有 SSE full-page reload server
- native parent 会观察 `builder.ts` 和已解析的 assets root; `appTitle`、`appComponent`、`mountId` 或 `assetsDirs` 变化会在同一端口重建临时 workspace 与 child, 无效配置保留当前 server, `port` 变化需要重启 `svelte-dev`; native child 自然退出时会串行复用实际端口重启, 连续失败最多自动重启 3 次, 主动停止与配置重建不会触发二次重启
- 真实浏览器 gate 已验证 self-accepting module 更新不刷新 document; 生成的 bootstrap 会接收根 `App.svelte` 更新并 remount 组件, 因此 CSS 更新不刷新 document 但组件局部状态会重置; 这不等于所有组件状态都能保留
- `svelte/compiler` 仍是底层编译器, plugin 只是 Bun bundler adapter; 项目不引入 Vite
- Bun 官方 frontend dev server 的 plugin 配置入口是 `bunfig.toml` 的 `[serve.static].plugins`; CLI 通过 `--config=<临时 bunfig.toml>` 传入该配置, 不依赖也不修改 consumer 的 `bunfig.toml`
- 当前实现与测试基线为 Bun `1.3.14`；升级 Bun 后应重新执行 builder tests、typecheck 和真实 consumer smoke
- native child 的 `exited` 生命周期由 parent 观察; child 连续异常退出达到上限后保留当前失效句柄并停止自动重启, 修改配置后可再次触发人工重建

公共配置与默认值：

| 配置 | 默认值 | 说明 |
| --- | --- | --- |
| `appComponent` | `"src/App.svelte"` | SPA 根组件, build/dev 都会据此生成内部启动代码 |
| `mountId` | `"app"` | build/dev 会使用该 DOM `id`; HTML shell 默认预生成对应节点, 如果外部页面缺少该节点, bootstrap 会创建 `<div id="...">` 并追加到 `document.body` |
| `appTitle` | `"Svelte Builder"` | 内置 shell 的 `<title>` |
| `assetsDirs` | `["assets"]` | 可选静态资源目录数组, 每个目录按目录名原样暴露; 若默认 `assets/` 不存在则视为无静态资源目录 |
| `outDir` | `"dist"` | 生产输出目录, 必须是项目根内的独立目录, 不能指向项目根或落在 app 源码树内 |
| `port` | `3000` | 开发服务器监听端口 |
| `sourcemap` | `false` | 生产构建是否输出内联 sourcemap |
| `stripSvelteDiagnostics` | `true` | 是否裁剪 Svelte 运行时详细诊断文案, 默认保留短错误码/警告码 |

`mountId` 始终是普通 DOM ID token, 不是 CSS selector. DOM 创建和组件挂载属于浏览器运行时入口; Bun 编译插件只在 `setup`/`onLoad` 阶段生成运行时模块, 不会在编译阶段访问页面 DOM.

`appComponent` 是可选配置:

```ts
export default {
    appComponent: "src/App.svelte",
    appTitle: "Svelte Builder",
};
```

`appComponent` 不配置时默认就是 `src/App.svelte`。

`assetsDirs` 是可选配置:

```ts
export default {
    assetsDirs: ["assets", "public"],
    appTitle: "Svelte Builder",
};
```

`assetsDirs` 不配置时默认尝试 `["assets"]`。若默认 `assets/` 不存在, builder 会按“当前项目没有静态资源目录”处理。数组中的每一项都必须是项目根内的目录, 并且目录名唯一。

`stripSvelteDiagnostics` 是可选配置:

```ts
export default {
    stripSvelteDiagnostics: true,
};
```

`stripSvelteDiagnostics` 的行为边界:

- `true` 时, 构建器会拦截 Svelte internal 的 diagnostics 模块, 去掉长错误文案, 但保留短错误码/警告码, 例如 `derived_references_self`、`hydration_mismatch`
- `false` 时, 保留 Svelte 原始运行时诊断实现, 方便调试或排查升级兼容性问题
- 这个能力依赖 Svelte internal 模块路径与导出形式, 升级 Svelte 后应重新执行一次 `bun test` 和 `bun run typecheck`, 并在真实消费项目里补跑一次 `svelte-build` 做回归验证

最小目录结构：

```text
src/
  App.svelte
assets/
public/
builder.ts
```

静态资源语义固定为“按目录名原样暴露”:

- dev: 例如 `assets/` 暴露为 `/assets/*`, `public/` 暴露为 `/public/*`
- build: 原样复制到 `<outDir>/assets/*`, `<outDir>/public/*`
- 不参与 hash, 不改名, 不注入到入口产物报告
- 目录名由配置目录本身决定, 不做额外 mount 映射

构建输出示例：

- `bun run build`

```text
Entry assets

File                 Size     Gzip
f35ba271.js       4.1 KiB  1.9 KiB
d0c5e184.css      4.6 KiB  1.4 KiB
index.html          274 B    217 B
```

- `bun dev`

```text
Recompiled assets

File                         Time                 Size     Gzip
src/lazy/ButtonDemo.svelte   2026-03-18 11:11:11  4.1 KiB  1.9 KiB
```

生产构建输出到 `dist`：

- 最终产物直接写入当前项目的 `<outDir>/`
- 构建开始时会清空当前 `<outDir>/`, 避免删除过的静态资源或旧 hash chunk 残留
- `outDir` 必须位于项目根目录内, 且必须是独立输出目录, 不能配置为 `.` 或落在 app 源码树内

安全注意事项：

- 配置文件固定为 `builder.ts`, 它通过默认导出提供构建配置, 同时也是项目根目录与所有默认值的唯一锚点
- `builder.ts` 会作为模块直接执行, 然后读取它的默认导出; 只应在可信项目里运行, 不要把它当成纯声明式配置文件
- 开发服务器的设计目标是本地开发, 不应当作为公网服务暴露; 受控 module route 的编译失败返回通用 500, Bun 官方 fullstack 页面在 `development` 模式下可能显示 compiler overlay, 因此 native dev 不能承载不可信访问流量
- 开发服务器只暴露受控 app 源码树、`/_node_modules/*` 和各静态资源目录对应的 URL 前缀, 并对路径穿越与符号链接逃逸做了边界校验, 但这不等于适合承载不可信访问流量
- 若当前环境里的 `fs.watch` 不可用, 开发服务器会直接输出 watcher 错误; 当前不再内置 polling fallback
- 若要部署到生产环境, 建议在反向代理或静态托管层补充安全响应头, 至少包括 `Content-Security-Policy`、`X-Content-Type-Options: nosniff` 和合适的 `Referrer-Policy`

## 升级敏感边界

`svelte-builder` 仍有一处刻意保留的升级敏感边界:

- Svelte dev/runtime alias 依赖已安装 `svelte` 包里的浏览器 runtime 入口文件, 包括 `svelte/internal/client`
- native 路径依赖 Bun `1.3.14` 的 fullstack HMR、`--config` watcher cwd 语义和 `Subprocess.exited`; 启动失败时的 fallback 仍使用 builder 自己的 SSE full-page reload 客户端

这不是通用公开 API 保证, 而是当前构建器行为所需的受控兼容边界。升级 Svelte 后, 应至少重新执行：

```bash
bun run test
bun run typecheck
```

当前源码仓库的依赖由仓库根目录统一管理。

安装依赖：

```bash
bun install
```

当前源码仓库本身不是一个 builder app, 根目录没有 `builder.ts`, 因此这里不再提供 `builder:dev` / `builder:build` 根脚本。

如果你要在真实项目里直接执行当前仓库里的命令行入口, 请在该项目目录下运行：

```bash
bun /._/svelte-lib/src/builder/dev.ts
bun /._/svelte-lib/src/builder/build.ts
```

作为项目依赖使用：

```bash
svelte-dev
svelte-build
```

当前仓库不再在 `src/builder/` 目录内内置示例组件或自用联调项目，也不再维护顶层样例 app。

建议的回归验证方式是：

```bash
bun test
bun run typecheck
bun run test:browser:native-hmr
```

其中 browser gate 需要环境提供 `playwright-cli`; 它会临时修改并恢复仓库内的 native HMR fixture。

如果你正在真实项目里使用本包, 还应在消费项目中额外执行一次：

```bash
svelte-build
```

这样能同时覆盖仓库内单元测试、类型检查, 以及真实项目里的构建集成路径。
