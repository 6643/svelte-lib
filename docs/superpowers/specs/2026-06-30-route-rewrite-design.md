# svelte-route 重构设计

## 目标

把 `src/route/` 重构成更小、更直接的实现，在不改变当前平铺 `<Route />` 使用方式的前提下，收敛内部状态、拆分职责、补齐错误与安全边界，并删除测试钩子和多余内部暴露。

这次重构允许：

- 保留 `Route` + 顶层导航 helper 的现有使用方式
- 收敛内部模块命名和职责
- 调整内部运行时结构
- 删除仅为旧实现服务的测试导出

这次重构不追求：

- 引入 `createRouter()` / provider 使用方式
- 保持当前内部单文件运行时结构
- 为旧实现形态保留复杂兼容分支

## 核心原则

1. 对外调用形态不变，内部实现彻底扁平化
2. 路由配置、导航解析、历史状态、运行时调度分开
3. 公开面只保留真实消费价值的导出
4. 错误路径显式化，保持原始上下文
5. 安全边界集中在 URL、history state 和浏览器事件入口

## 方案

### 1. 公开面收敛

`src/route/_.ts` 继续作为子路径导出入口，但只保留：

- `Route`
- `routePush`
- `routeReplace`
- `routeCurrentPath`
- `routeBackPath`

移除或不再公开：

- 测试专用导出
- 运行时内部 helper
- 不直接服务消费方的校验函数

### 2. 内部模块拆分

`src/route/` 内部按职责拆成以下模块：

- `validation.ts`：`<Route />` 配置校验、decoder 校验、懒加载 loader 形状校验
- `runtime.ts`：单例 runtime、注册、订阅、当前匹配、浏览器事件绑定
- `history.ts`：managed history state 构造、签名、归一化、回退链维护
- `navigation.ts`：导航目标归一化、同源与路径安全检查
- `query.ts`：query decoder 和 props 生成
- `lazy.ts`：懒加载 component 解析和 promise 形状校验

`Route.svelte` 只保留挂载期校验、注册、订阅、懒加载、渲染。

### 3. 运行时模型

运行时仍然是“隐式单例”，但状态不再散落在多个顶层变量里。  
`runtime.ts` 内部持有一个明确的 runtime 对象，统一管理：

- 当前路径
- 路由条目表
- 匹配缓存
- 订阅者集合
- 当前 `window` 绑定
- managed history state

这样可以把副作用边界压到一个模块里，避免 `Route.svelte` 直接操纵全局状态。

### 4. 路由语义

保留当前平铺写法的语义：

- `path="/"` 和 `path="*"` 继续支持
- query 继续只参与 props 解码，不参与匹配
- 路由注册顺序仍然决定相同路径的覆盖顺序
- 懒加载仍然支持零参数 loader
- 导航 helper 继续支持绝对路径、仅 query 和同源绝对 URL

需要明确收紧的点：

- `Route` 挂载后配置不可变
- 非法 `path`、非法 decoder、非法 loader 都要立即报错
- 外部直接修改原生 `history.state` 不再被修复成 router-managed 链路

### 5. 错误处理

必须覆盖以下错误路径：

- 非法 route 配置
- 非法 decoder
- 懒加载 loader 不是 promise
- 懒加载模块没有函数型 default export
- 不是浏览器环境时调用路由 API
- 非法导航目标
- 浏览器 `popstate` 读取到不可信 state

错误输出要求：

- 保留原始上下文
- 维持当前语义，不吞错
- 对外暴露的错误信息保持可读

### 6. 安全边界

虽然这里没有文件系统边界，但仍然有明确的输入边界：

- `path` 只接受绝对 pathname 或 `*`
- 导航目标只接受受支持的 URL 形式
- `history.state` 只信任带正确签名的 managed state
- `href` 拦截只接受可安全处理的目标

重点防线：

- 路径穿越式输入 `.` / `..`
- 跨源 URL
- `//` 形式的网络路径
- 伪造 managed history state

### 7. 测试补强

当前测试需要补回并覆盖这些路径：

- 公开导出是否过多
- `Route` 配置校验
- query decoder 语义
- 懒加载成功和失败路径
- 导航归一化与非法输入
- history state 归一化与签名校验
- route 注册、覆盖、注销与匹配缓存
- `popstate` 同步与订阅通知

## 预期结果

重构后 `src/route/` 应该呈现为：

- 更少的职责重叠
- 更小的 `Route.svelte`
- 更明确的 runtime 边界
- 更少的内部暴露
- 更强的测试覆盖

## 回退策略

按文件和行为分阶段提交，任何阶段都能单独回退。
