# svelte-lib/route

一个通过 `svelte-lib/route` 子路径导出的、仅面向 Bun 的轻量 SPA 路由实现。

## 特性

- 独立子路径导出，保持 Bun-first 工作流
- 声明式 `<Route>` 组件接口
- 精确路径匹配与 `*` 兜底路由
- 基于 `$name` 语法的 query 解码 props
- 程序化导航辅助方法
- 浏览器前进与后退同步
- 懒加载路由组件

## 安装

```bash
bun add /._/svelte-lib
```

当前仓库按本地私有包方式维护。
在消费项目里使用本地路径或 workspace 依赖后，再从 `svelte-lib/route` 导入。

## 快速开始

```svelte
<script lang="ts">
  import { Route } from 'svelte-lib/route';

  import Home from './routes/Home.svelte';
  import User from './routes/User.svelte';
  import NotFound from './routes/NotFound.svelte';
</script>

<Route path="/" component={Home} />
<Route path="/user" component={User} $id={Number} />
<Route path="*" component={NotFound} />
```

当访问 `/user?id=7` 时，`User` 组件会收到：

```ts
{
  id: 7
}
```

## Route 组件接口

`Route` 只接受以下配置项：

- `path`：要匹配的精确 `pathname`，或 `*` 作为兜底路由
- `component`：Svelte 组件，或零参数懒加载函数 `() => import(...)`
- `$name`：可选 query 解码器，把 `?name=value` 解码成注入目标组件的 `name` prop

除 `path`、`component` 与 `$name` 形式的 decoder 配置外，其他 Route 配置项都会抛错。

匹配规则：

- 多个路由声明同一个精确 `path` 时，后注册者生效
- 没有精确匹配时，最后注册且仍存活的 `path="*"` 生效
- 查询字符串不参与路由匹配
- 路由配置在挂载后视为不可变，包括 `path`、`component` 与 decoder 定义
- `path` 必须是 `*`，或不带 query、hash、`.`、`..` 段的绝对 `pathname`

## Query 解码 props

内置解码器：

- `String`
- `Number`
- `Boolean`

也支持自定义解码器：

```svelte
<script lang="ts">
  import { Route } from 'svelte-lib/route';

  import Search from './routes/Search.svelte';

  const parseTags = (raw: string | null) => raw?.split(',').filter(Boolean);
</script>

<Route
  path="/search"
  component={Search}
  $page={Number}
  $enabled={Boolean}
  $tags={parseTags}
/>
```

当访问 `/search?page=2&enabled=true&tags=red,blue` 时，`Search` 会收到：

```ts
{
  page: 2,
  enabled: true,
  tags: ['red', 'blue']
}
```

解码器行为：

- 缺失的 query key 会变成 `undefined`
- 非法 `Number` 和 `Boolean` 值会变成 `undefined`
- 重复 query key 只取第一个值
- 自定义解码器抛出的异常会继续向上冒泡

防御性解码器建议：

- 把 query 输入视为不可信数据
- 解码器接收的是解码后的字符串值或 `null`
- 尽量保持纯函数、无副作用
- 能返回 `undefined` 时，优先返回 `undefined`，不要把非法输入一律改成抛错
- 避免对无界输入做高成本解析

## 导航辅助方法

```ts
import {
  routeBackPath,
  routeCurrentPath,
  routeForwardPath,
  routePush,
  routeReplace
} from 'svelte-lib/route';

routePush('/user?id=1');
routePush('?page=2');
routeReplace('https://app.test/user?id=3');

const current = routeCurrentPath();
const back = routeBackPath(); // string | null
const forward = routeForwardPath(); // string | null
```

支持的导航输入：

- `/user?id=1` 这类应用内绝对路径
- `?page=2` 这类仅更新 query 的目标
- 同源绝对 URL

导航行为：

- `routePush()` 会追加新的历史记录项
- `routeReplace()` 会覆盖当前历史记录项
- 导航到当前归一化路径时不会执行任何操作
- 纯 hash 导航目标会被当作无操作并忽略
- 浏览器前进/后退会同步更新路由渲染与辅助方法输出
- 原生同文档 `history.pushState()` / `history.replaceState()` 会同步到路由状态
- 路由管理的 back/forward hint 最多保留最近 100 条 managed entry
- 仅 query 的更新会保留当前 hash fragment

以下非法导航输入会抛错：

- `foo`
- `./foo`
- `../foo`
- `//elsewhere.test/path`
- pathname 以 `//` 开头的同源绝对 URL
- 任意跨源绝对 URL

## 懒加载路由

`component` 也支持零参数加载器：

```svelte
<script lang="ts">
  import { Route } from 'svelte-lib/route';
</script>

<Route path="/settings" component={() => import('./routes/Settings.svelte')} />
```

懒加载行为：

- 加载器 pending 期间不会渲染默认加载界面
- 解析后的模块 `default` 导出会被渲染
- 加载器错误会继续向上抛出
- 若路由在加载器 pending 期间失活后又重新激活，会复用同一个 pending load
- 懒加载失败后，离开并重新进入该路由会触发一次新的重试
- 加载器必须是返回 promise 的零参数函数
- 解析后的模块必须暴露函数值 `default` 组件导出

## 边界

- 仅支持客户端 SPA 路由
- 需要浏览器环境
- 路由管理的 history metadata 只在当前 runtime session 内有效；过期或外部 managed state 会被修复到当前路径
- 不包含动态路径参数
- 不包含嵌套路由
- 不包含 anchor interception
- hash fragment 不参与 route 匹配语义，传入导航目标里的 hash fragment 也会被忽略

## 开发

```bash
bun install
bun test
bun run typecheck
```

开发说明：

- 仓库 `devDependencies` 遵循 `latest` 策略，使本地验证持续对齐当前 Bun 与 Svelte 发布
- 库的 `peerDependencies` 也和包根目录一样使用 `latest` 策略
