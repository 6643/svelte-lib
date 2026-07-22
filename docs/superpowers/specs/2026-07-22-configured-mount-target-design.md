# Configured Mount Target Design

## Goal

让 `svelte-lib` 的应用入口和运行时扩展使用同一套挂载配置, 并保持现有消费项目写法不变:

```ts
export default {
    mountId: "app",
};
```

当页面已经有对应 ID 的元素时, 直接使用该元素挂载. 当页面没有对应元素时, 自动创建一个 `<div>`、设置配置中的 ID, 追加到 `document.body`, 然后完成挂载. 该行为与 `solid-lib` 当前 builder 行为一致.

## Current Evidence

- [src/builder/config.ts](../../../src/builder/config.ts) 已将 `mountId` 作为唯一的公共挂载配置, 默认值为 `"app"`, 并拒绝 selector 形状的值.
- [src/builder/build-internals.ts](../../../src/builder/build-internals.ts) 的 `createBootstrapSource()` 通过 `document.getElementById(mountId)` 查找目标, 找不到时创建 fallback `<div>` 并追加到 `document.body`.
- build、SSE dev 和 native dev 都通过 `createBootstrapSource()` 生成入口, 因此共享该函数即可统一三条应用挂载路径.
- `createRuntimeModuleSource()` 已生成带配置 ID 的运行时目标读取函数, 与 bootstrap 使用相同的 fallback 语义.
- [src/builder/runtime.ts](../../../src/builder/runtime.ts) 提供未经过 builder 注入时的默认运行时实现, [src/builder/svelte-plugin.ts](../../../src/builder/svelte-plugin.ts) 则负责 Bun plugin 适配和按配置注入 runtime module.
- `src/builder/svelte-plugin.ts` 是 Bun 编译插件, 负责把 `.svelte` 与 rune module 编译为浏览器 JavaScript; 它不应在 Bun 的 `setup`/`onLoad` 阶段访问页面 DOM, 只生成在浏览器模块执行时使用的 runtime source.
- Svelte 5 的 `mount()` 继续接收 `target` 元素, 因此不需要改动现有 `mount(App, { target })` 调用形式.

## Design

### Single source of truth

`mountId` 继续是唯一公共配置字段, 不新增 `mountPlugin`, `mountTarget` 或 selector 配置. 现有 builder 配置、demo 配置和插件编译配置保持原样.

`mountId` 是配置单一事实来源, 挂载解析逻辑在 builder 生成的 runtime source 与公开默认 runtime 中保持同一契约. builder internals 的共享 source generator 由以下两个生成入口复用:

- `createBootstrapSource()` 用于应用根组件的 build/dev/native bootstrap.
- `createRuntimeModuleSource()` 用于需要读取当前配置挂载点的生成 runtime module.

自定义 Bun pipeline 需要显式安装 mount target plugin, 让 `svelte-lib/runtime` 使用当前 pipeline 的配置:

```ts
import { createMountTargetPlugin, createSvelteBunPlugin } from "svelte-lib/builder";

await Bun.build({
    entrypoints: ["src/main.ts"],
    plugins: [
        createMountTargetPlugin("plugin-root"),
        createSvelteBunPlugin({ mode: "dev" }),
    ],
});
```

共享逻辑的语义为:

```ts
let target = document.getElementById(mountId);

if (!target) {
    const body = document.body;
    if (!body) {
        throw new Error("Cannot create mount target before document.body exists");
    }
    target = document.createElement("div");
    target.id = mountId;
    body.append(target);
}
```

配置校验仍保持不变: `mountId` 必须是非空、无空白、非 `#` 开头的 DOM ID token. 不把 `mountId` 解释为 CSS selector, 避免改变已有配置语义.

### Existing target and fallback target

- 已存在的目标元素不被替换、不清空、不重新追加.
- 缺失目标只创建一个 fallback `<div>`.
- fallback 的父节点固定为 `document.body`, 与 `solid-lib` 一致.
- 内置 HTML shell 仍预生成当前的 `<main id="...">`; 正常 build/dev 页面因此保持现有语义和结构.
- fallback 只覆盖“外部页面没有提供 mount root”的场景, 不改变 HTML shell 的生成责任.

### Plugin boundary

编译插件的公共写法保持函数式配置:

```ts
export default createSvelteBunPlugin({ mode: "dev" });
```

需要读取默认挂载目标时, 直接使用公开 runtime:

```ts
import { getMountTarget } from "svelte-lib/runtime";

const target = getMountTarget();
mount(App, { target });
```

自定义 `mountId` 时, 由 builder 自动注入的 pipeline 或显式的 `createMountTargetPlugin(mountId)` 负责生成对应 runtime module; runtime plugin 不在 Bun 的 `setup` 或 `onLoad` 阶段访问页面 DOM. 需要挂载组件的入口仍使用 Svelte 5 的原生形式:

```ts
mount(App, { target });
```

本次增加了可独立使用的 `svelte-lib/runtime` 默认 runtime API, 但不增加第二套挂载配置或组件挂载抽象, 也不让编译插件隐式执行浏览器副作用.

### Error handling

- `mountId` 非法时继续在配置加载或 source generation 阶段快速失败.
- `document.getElementById()` 返回 null 时不再抛出缺失 mount target 错误, 而是创建 fallback.
- 如果运行环境没有可用的 `document.body`, 生成入口抛出明确错误, 不静默丢弃挂载.
- 已存在的重复 ID 遵循浏览器 `getElementById()` 的原生首个匹配行为, 不额外扫描或重写页面.

## Verification

测试覆盖分为三层:

1. source contract: bootstrap 和 runtime module 都包含查找、创建、设置 ID、append 到 body 的代码, 不再生成缺失目标异常.
2. generated runtime behavior: 在 browser/jsdom document 中执行生成的目标解析逻辑, 分别验证已有目标复用和缺失目标创建; 公开 `svelte-lib/runtime` 也验证默认 `app` 目标行为.
3. plugin integration: 验证 `createSvelteBunPlugin` 编译组件和 rune module, `createMountTargetPlugin` 注入配置 runtime, 以及 Bun fullstack plugin 入口.
4. integration regression: build、SSE dev、native dev 继续生成原有 HTML mount root, demo check、全量测试、typecheck 和真实浏览器 HMR gate 保持通过.

## Scope

本阶段包含:

- 统一 `mountId` 的 fallback 创建行为.
- 让 bootstrap 与 runtime module 遵循同一解析规则.
- 提供可显式复用的 Bun compiler plugin 和 mount target plugin.
- 提供 `svelte-lib/runtime` 的默认运行时入口.
- 同步 builder 文档与测试.

本阶段不包含:

- 新增 selector、parent、before/after 等第二套位置配置.
- 改变 `mountId` 的类型或默认值.
- 在 Bun 编译插件的 `setup`/`onLoad` 阶段访问 DOM.
- 引入 Vite、Rollup 或其他构建器.
- 改变现有 Svelte 5 `mount()` 调用签名.

## Rollback

变更集中在 mount source generator、其测试和 builder 文档中. 如 fallback 语义需要回退, 可恢复“缺失目标抛错”的两处生成逻辑, 不影响配置解析、编译插件和 HTML shell 生成.
