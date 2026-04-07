# Route / Builder Weight And Bundle Size Design

## 背景

当前仓库里有两个彼此相关、但不应混为一谈的问题：

1. `route` 与 `builder` 的内部实现承担了过多职责，代码观感偏重
2. `demo` 的浏览器首包体积偏大，且之前的构建报表没有把共享 chunk 完整展示出来

已有取证结论：

- `builder` 本身没有被打进浏览器 bundle；它只作为 [`demo/builder.ts`](../../../demo/builder.ts) 的构建期依赖存在
- 浏览器构建中的主要大块是共享 JS chunk，而不是入口 JS
- `demo/src/App.svelte` 当前静态导入了 `Home`、`NotFound`、`Profile`，只有 `/lazy` 路由是按需加载
- `route` 当前不仅负责匹配，还负责 history patch、外部 state 修复、snapshot 对比、query decoder 与 lazy route 生命周期
- `builder` 当前不仅负责 build，还同时承担 import graph 校验、runtime alias、dev import 重写、watch、live reload 与 `Bun.serve`

因此，这次设计必须明确区分：

- 哪些动作是为了真实降低浏览器首包
- 哪些动作是为了让 `route` / `builder` 的职责边界更清晰

## 目标

1. 在不破坏公开契约的前提下，优先降低 `demo` 的浏览器首包体积
2. 把 `route` 与 `builder` 的内部职责按边界拆开，降低核心文件的认知负担
3. 保持以下公开入口与 CLI 名称不变：
   - `svelte-lib/route`
   - `svelte-lib/builder`
   - `svelte-build`
   - `svelte-dev`
4. 保持现有功能语义不变：
   - route 的 history 同步、query decoder、lazy route
   - builder 的 build / dev 能力与当前配置入口

## 非目标

1. 不在这轮引入新的路由框架或新的构建框架
2. 不改公开导入路径或新增对外 breaking change
3. 不通过删能力来“伪瘦身”
4. 不把 `route` / `builder` 的内部拆分和其它无关重构混在一起

## 已确认约束

### 公开契约约束

- `route` 对外仍由 `src/route/_.ts` 暴露
- `builder` 对外仍由 `src/builder/_.ts` 暴露
- CLI 仍为 `svelte-build` 与 `svelte-dev`

### 体积问题约束

- 真实首包大小需要以构建产物中的所有 JS chunk 为准，而不是只看 entry JS
- 由于 `builder` 不进浏览器 bundle，因此“让 builder 文件更薄”本身不会直接显著降低首包

### 稳定性约束

- `route` 当前的 history 修复与外部 state 兼容逻辑已有较多测试覆盖，不能在缺验证的情况下直接砍掉
- `builder` 当前对 Svelte runtime alias 和 import graph 的控制是已知关键路径，不能在未验证前替换实现

## 选定方案

采用“两阶段主线 + 一阶段整理”的方案：

### 第一阶段：优先降低首包

只处理真实影响浏览器初始下载体积的部分，不碰公开契约：

1. 把 `demo` 中当前静态导入的非首页 route 页面按需加载
2. 让 builder 构建报表持续显示所有共享 JS chunk，作为体积收敛依据

优先目标：

- 把 `Profile` 以及必要时的 `NotFound` 从首屏共享 chunk 中移出
- 继续保留 `Home` 作为首页同步路由

### 第二阶段：拆 `route` 的内部职责

保持 `src/route/_.ts` 不变，把现有核心逻辑按职责下沉：

- `route-history-sync.ts`
  - 负责 runtime 初始化
  - 负责 history patch / popstate
  - 负责 history state snapshot 与修复
- `route-registry.ts`
  - 负责 route 注册、匹配与订阅通知
- `route-lazy.ts`
  - 负责 lazy loader、pending / failure / retry 生命周期

`router.svelte.ts` 保留为薄入口，只做组合与对外转发。

### 第三阶段：拆 `builder` 的内部职责

保持 `src/builder/_.ts` 不变，把 `build.ts` / `dev.ts` 拆成稳定职责单元：

- `build-config.ts`
  - 负责读取与校验 `builder.ts`
- `build-runtime-alias.ts`
  - 负责 Svelte runtime alias 与诊断裁剪相关逻辑
- `build-publish.ts`
  - 负责 stage / temp / publish / cleanup
- `dev-import-resolution.ts`
  - 负责 dev 下的 bare import 重写
- `dev-watch.ts`
  - 负责 watch roots、事件分类与 reload 触发
- `dev-server.ts`
  - 负责 `Bun.serve`、请求分发与 live reload

`build.ts` / `dev.ts` 保留为 orchestration 层，不再长期堆积底层细节。

## 备选方案与取舍

### 方案 A：只做 `demo` lazy 化，不拆内部职责

优点：

- 最快看到首包下降
- 风险最低

不选为最终方案的原因：

- 只能解决体积，不解决 `route` / `builder` 的长期可维护性问题

### 方案 B：只拆 `route` / `builder`，不动 `demo`

优点：

- 代码结构会更清楚

不选为最终方案的原因：

- 无法先兑现“首包变小”这一最直接收益

### 方案 C：直接删减 `route` / `builder` 当前能力

不选理由：

- 这是高风险语义变更，不符合当前“先收敛问题、再安全重组”的原则

## 影响范围

### 第一阶段

- `demo/src/App.svelte`
- `demo/src/routes/*`
- 与构建报表相关的 builder 文件与测试

### 第二阶段

- `src/route/router.svelte.ts`
- `src/route/Route.svelte`
- 新增若干 `src/route/*` 内部职责文件
- `src/route/tests/*`

### 第三阶段

- `src/builder/build.ts`
- `src/builder/dev.ts`
- 新增若干 `src/builder/*` 内部职责文件
- `src/builder/tests/*`

### 不应外溢的范围

- `package.json` 的公开 `exports`
- `demo` 以外的消费方公开导入方式
- CLI 名称

## 风险

### 中风险：route 内部拆分时引入行为漂移

主要风险点：

- history patch 时机变化
- duplicate state / snapshot 逻辑回归
- lazy route 生命周期变化

缓解：

- 保持公开 API 不变
- 拆分时先搬运、后收缩
- 以现有 `src/route/tests/*` 为主回归面

### 中风险：builder 内部拆分时打散关键约束

主要风险点：

- import graph 校验与 dev import 重写边界被打断
- runtime alias 与诊断裁剪顺序变化

缓解：

- 先固化 builder 测试
- 不同时改行为与文件边界
- 保持 `build.ts` / `dev.ts` 仍作为总编排入口

### 低风险：demo lazy 化造成页面加载路径变化

缓解：

- 只把非首页 route 改为 lazy
- 通过 `demo build` 产物与手动运行回归验证

## 验证策略

### 第一阶段

至少验证：

1. `bun run --cwd demo build`
2. 对比共享 chunk 与入口 chunk 的体积变化
3. `bun run --cwd demo typecheck`

### 第二阶段

至少验证：

1. `bun test src/route/tests`
2. `bun run typecheck`
3. 如有需要，再跑 `bun run --cwd demo build`

### 第三阶段

至少验证：

1. `bun test src/builder/tests`
2. `bun run typecheck`
3. `bun run --cwd demo build`
4. `bun run --cwd demo dev`

## 回滚

按阶段回滚，不做整轮联动回退：

1. 若第一阶段体积收益不符合预期，回退 `demo` 路由 lazy 化改动
2. 若第二阶段 route 行为回归，回退 route 内部拆分提交，但保留已验证的首包优化
3. 若第三阶段 builder 行为回归，回退 builder 内部拆分提交，但保留前两阶段成果

由于公开导入路径不变，回滚重点在内部实现恢复，而不是外部契约回退。

## 实施建议

推荐顺序：

1. 先做 `demo` route lazy 化，拿到真实体积下降
2. 再做 `route` 内部拆分，降低运行时核心层负担
3. 最后做 `builder` 内部拆分，降低工具层维护复杂度

不要把这三步混成一个提交；每一阶段都应单独验证、单独可回滚。
