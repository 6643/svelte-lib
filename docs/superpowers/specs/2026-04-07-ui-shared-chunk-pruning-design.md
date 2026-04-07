# UI Shared Chunk Pruning Design

## 目标

1. 在不改变公开导入路径的前提下，降低 `demo` 浏览器构建中的最大共享 JS chunk
2. 让 `demo` 未使用的 `svelte-lib/ui` 组件不再进入共享首包
3. 保持以下公开契约不变：
   - `svelte-lib/ui`
   - `svelte-lib/route`
   - `svelte-lib/use`
   - `svelte-lib/builder`
4. 为后续 `route` / `builder` 内部瘦身提供更准确的体积基线

## 非目标

1. 不在这轮修改 `route` 或 `builder` 的公开 API
2. 不在这轮引入新的 bundler、插件系统或第三方依赖
3. 不通过删除 `ui` 现有组件能力来换取更小体积
4. 不把内部职责拆分和浏览器首包裁剪混成一次大改

## 现状约束

1. `demo` 的页面级 lazy route 已经生效，但最大共享 JS chunk 仍保持 `72267` 字节
2. `builder` 本身没有进入浏览器 bundle，因此继续拆 `builder` 文件不会直接降低当前共享 chunk
3. `route` runtime 确实是共享 chunk 的一部分，但它不是唯一来源
4. `demo` 中所有页面都从 `svelte-lib/ui` 这一公共子路径导入 UI 组件
5. `src/ui/_.ts` 当前以单一 barrel 形式导出全部 UI 组件
6. 构建产物中已能观察到未被 `demo` 使用的 UI 特征串，例如：
   - `swiper-container`
   - `drag-handle`
   - `<video`
7. 这说明当前至少存在一层 `ui` 侧的 tree-shaking / 共享抽取失效或不足

## 主方案

采用“两步收敛，先证据后修复”的最小方案。

### 第一步：把问题锁成可回归的构建契约

新增一个面向 `demo build` 产物的回归测试，验证最大共享 JS chunk 不应包含与当前 demo 无关的 UI 特征。

首批锁定的反例特征：

- `swiper-container`
- `drag-handle`
- `<video`

这一步的目的不是证明 chunk 达到某个绝对体积，而是先锁定“未使用 UI 不应进入共享 chunk”这一正确行为。

### 第二步：优先用最小元数据修复可裁剪性

先尝试不改公开导入路径的最小修复：

1. 检查并补齐包级 tree-shaking 元数据
2. 保持 `src/ui/_.ts` 公开入口不变
3. 重新构建并验证共享 chunk 中是否移除未使用 UI 特征

如果这一步有效，则本轮到此结束，不扩大到公共子路径拆分。

### 第三步：仅在元数据无效时再拆 `ui` 公开导出边界

若包级元数据不足以让 Bun 正确裁剪 `svelte-lib/ui`，再进入更明确的导出边界拆分：

1. 保持 `svelte-lib/ui` 作为兼容入口存在
2. 在内部把高成本组件拆到更细的可裁剪模块
3. 让 `demo` 只导入当前实际使用的 UI 导出面

这一层属于第二选择，只有在前一层证据证明无效时才执行。

## 必要备选与取舍

### 方案 A：继续只做页面 lazy 化

优点：

- 改动最小

不选原因：

- 当前证据已经表明页面 lazy 化只缩小了入口 chunk，没有缩小最大共享 chunk

### 方案 B：直接先拆 `route` 内部职责

优点：

- 能降低 `route` 代码观感负担

不选原因：

- 当前共享 chunk 问题有明确的 `ui` 侧证据，先动 `route` 不是最短根因路径

### 方案 C：直接重构 `ui` 公共入口

优点：

- 可能一次性解决裁剪边界问题

不选为主方案的原因：

- 风险比补元数据高，且在未证明元数据无效前属于过早扩范围

## 影响范围

### 必然影响

- `package.json`
- `tests/*` 中新增或修改的构建产物回归测试
- 可能涉及 `demo/src/*` 的导入面

### 条件影响

- 若元数据方案无效，才会影响 `src/ui/*` 的内部导出组织

### 明确不应外溢

- `svelte-lib/ui` 的公开导入名
- `svelte-lib/route`
- `svelte-lib/use`
- `svelte-build`
- `svelte-dev`

## 验证方式

至少按以下顺序验证：

1. 新增的共享 chunk 回归测试先红灯，再转绿
2. `bun run --cwd demo build`
3. 检查最大共享 JS chunk 中是否仍出现：
   - `swiper-container`
   - `drag-handle`
   - `<video`
4. `bun run --cwd demo typecheck`
5. 如修改了 `package.json` 或测试策略，再跑相关定向测试

本轮验收以“未使用 UI 不再进入共享 chunk”为主，不再以“最大 chunk 必须小于 72267”作为唯一条件。

## 生效 / 切换条件

1. 若只通过元数据修复，则无外部切换步骤，构建后立即生效
2. 若需要拆细 `ui` 导出边界，必须先保持 `svelte-lib/ui` 兼容入口可用，再调整 `demo` 消费方式
3. 任何需要修改 `demo` 导入面的动作，都应在共享 chunk 回归测试已建立之后进行

## 回滚方案

1. 若元数据修复导致构建异常或测试回归，直接回退对应 `package.json` 与测试改动
2. 若 `ui` 导出边界拆分引入兼容性问题，保留 `svelte-lib/ui` 原兼容入口并回退 `demo` 导入调整
3. 回滚后至少重跑：
   - `bun run --cwd demo build`
   - 相关共享 chunk 回归测试
   - `bun run --cwd demo typecheck`

## 实施步骤

1. 先写共享 chunk 回归测试，锁定当前错误行为
2. 运行红灯验证，确认测试确实因未使用 UI 泄漏进共享 chunk 而失败
3. 实施最小元数据修复
4. 重新构建并转绿
5. 若元数据修复无效，再单独写下一版计划，进入 `ui` 导出边界拆分
