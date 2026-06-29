# svelte-route Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 保留平铺 `<Route />` 的对外用法，重写 `src/route/` 的内部结构、错误边界和测试覆盖，收敛公开面并删除测试钩子。

**Architecture:** 以 `validation.ts`、`runtime.ts`、`history.ts`、`navigation.ts`、`query.ts`、`lazy.ts` 分离职责；`Route.svelte` 只做壳层；`_.ts` 只导出真正需要的入口。内部仍维持单例 runtime，但把状态和副作用集中到一个模块。

**Tech Stack:** TypeScript, Svelte 5, Bun, bun:test, jsdom

## Global Constraints

- 保留当前平铺 `<Route />` 写法
- 不引入 `createRouter()` / provider API
- 不保留旧实现的测试专用导出
- 路由配置挂载后不可变
- 导航 helper 继续只支持受支持的 URL 形式
- `history.state` 只信任带正确签名的 managed state
- 懒加载 loader 必须是零参数 promise 返回函数

---

### Task 1: 收口公开导出并建立导出契约

**Files:**
- Modify: `src/route/_.ts`
- Modify: `tests/package-exports.test.ts`
- Add: `src/route/tests/export-surface.test.ts`

**Interfaces:**
- Consumes: current route public exports
- Produces: a reduced and explicit route public surface

- [ ] **Step 1: Write the failing export-surface test**

```ts
import { expect, test } from "bun:test";
import * as route from "../_.ts";

test("route public surface stays intentionally small", () => {
    expect("initRouteSystem" in route).toBe(false);
    expect("registerRoute" in route).toBe(false);
    expect("subscribeRuntime" in route).toBe(false);
    expect("getMatchedRouteId" in route).toBe(false);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun test src/route/tests/export-surface.test.ts`
Expected: fail until internal runtime helpers stop leaking through the package surface.

- [ ] **Step 3: Narrow `src/route/_.ts` to only the intended public API**

```ts
export { default as Route } from './Route.svelte';
export {
    routeBackPath,
    routeCurrentPath,
    routePush,
    routeReplace,
} from './runtime.ts';
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun test src/route/tests/export-surface.test.ts tests/package-exports.test.ts`
Expected: pass.

### Task 2: Extract route validation and lazy resolution

**Files:**
- Add: `src/route/validation.ts`
- Add: `src/route/lazy.ts`
- Modify: `src/route/Route.svelte`
- Add: `src/route/tests/validation.test.ts`

**Interfaces:**
- Consumes: raw `Route` props
- Produces: validated config, decoder map, lazy loader checks, lazy component resolution

- [ ] **Step 1: Write failing tests for route config validation**

```ts
import { expect, test } from "bun:test";
import { validateRouteConfig } from "../validation.ts";

test("validateRouteConfig rejects relative path", () => {
    expect(() =>
        validateRouteConfig({ path: "foo", component: () => null }),
    ).toThrow("Route path must be \"*\" or an absolute pathname without query or hash");
});
```

- [ ] **Step 2: Run the validation test to verify it fails**

Run: `bun test src/route/tests/validation.test.ts`
Expected: fail until validation is extracted from `Route.svelte`.

- [ ] **Step 3: Move validation and lazy resolution into pure helpers**

```ts
export const validateRouteConfig = (input: Record<string, unknown>) => { /* ... */ };
export const isPromiseLike = (value: unknown): value is PromiseLike<unknown> => { /* ... */ };
export const resolveLazyRouteComponent = (module: unknown) => { /* ... */ };
```

- [ ] **Step 4: Run the validation test to verify it passes**

Run: `bun test src/route/tests/validation.test.ts`
Expected: pass.

### Task 3: Rebuild route runtime as a single internal state holder

**Files:**
- Add: `src/route/runtime.ts`
- Modify: `src/route/Route.svelte`
- Add: `src/route/tests/runtime.test.ts`

**Interfaces:**
- Consumes: validated route entries, browser environment, navigation helpers
- Produces: `initRuntime`, `subscribeRuntime`, `registerRoute`, `getMatchedRouteId`, `routePush`, `routeReplace`, `routeCurrentPath`, `routeBackPath`

- [ ] **Step 1: Write failing tests for route registration and match selection**

```ts
import { expect, test } from "bun:test";
import { __resetRuntimeForTest, getMatchedRouteId, initRuntime, registerRoute } from "../runtime.ts";

test("last exact route wins and wildcard acts as fallback", () => {
    __resetRuntimeForTest();
    initRuntime();

    const a = Symbol("/a");
    const fallback = Symbol("*");

    const unregisterFallback = registerRoute({ id: fallback, path: "*", component: (() => null) as never, decoders: {} });
    const unregisterA = registerRoute({ id: a, path: "/a", component: (() => null) as never, decoders: {} });

    expect(getMatchedRouteId()).toBe(a);

    unregisterA();
    expect(getMatchedRouteId()).toBe(fallback);

    unregisterFallback();
});
```

- [ ] **Step 2: Run the runtime test to verify it fails**

Run: `bun test src/route/tests/runtime.test.ts`
Expected: fail until runtime is extracted.

- [ ] **Step 3: Move single-runner state, browser binding, and subscription logic into `runtime.ts`**

```ts
type RouteRuntime = {
    currentPath: string;
    entries: RouteEntry[];
    listeners: Set<() => void>;
    matchedRouteId: symbol | null;
    matchDirty: boolean;
};
```

- [ ] **Step 4: Run the runtime test to verify it passes**

Run: `bun test src/route/tests/runtime.test.ts`
Expected: pass.

### Task 4: Split navigation, history, and query decoding

**Files:**
- Add: `src/route/navigation.ts`
- Add: `src/route/history.ts`
- Add: `src/route/query.ts`
- Modify: `src/route/runtime.ts`
- Add: `src/route/tests/navigation.test.ts`
- Add: `src/route/tests/history.test.ts`
- Add: `src/route/tests/query.test.ts`

**Interfaces:**
- Consumes: current path, browser origin, decoder maps, managed history state
- Produces: normalized navigation targets, managed state builders, decoded props

- [ ] **Step 1: Write failing tests for navigation safety and query decoding**

```ts
import { expect, test } from "bun:test";
import { normalizeNavigationTarget } from "../navigation.ts";
import { decodeRouteProps } from "../query.ts";

test("normalizeNavigationTarget rejects cross-origin targets", () => {
    expect(() => normalizeNavigationTarget("https://evil.test/a", "/a", "https://app.test")).toThrow("Cross-origin navigation is not supported: https://evil.test/a");
});

test("decodeRouteProps turns invalid Number query into undefined", () => {
    expect(decodeRouteProps("?page=abc", { $page: Number })).toEqual({ page: undefined });
});
```

- [ ] **Step 2: Run the new tests to verify they fail where extraction is missing**

Run: `bun test src/route/tests/navigation.test.ts src/route/tests/history.test.ts src/route/tests/query.test.ts`
Expected: fail until helpers are split out and wired back in.

- [ ] **Step 3: Move the helper logic into dedicated modules and keep runtime thin**

```ts
export const routePush = (target: string): void => navigate('push', target);
export const routeReplace = (target: string): void => navigate('replace', target);
```

- [ ] **Step 4: Run the helper tests to verify they pass**

Run: `bun test src/route/tests/navigation.test.ts src/route/tests/history.test.ts src/route/tests/query.test.ts`
Expected: pass.

### Task 5: Rewrite `Route.svelte` as a thin shell

**Files:**
- Modify: `src/route/Route.svelte`
- Add: `src/route/tests/route-component.test.ts`

**Interfaces:**
- Consumes: `validateRouteConfig`, `registerRoute`, `subscribeRuntime`, lazy helpers, query decoding
- Produces: a thin mounted component that renders only when active and resolved

- [ ] **Step 1: Write failing tests for mount-time immutability and lazy loading**

```ts
import { expect, test } from "bun:test";

test("Route rejects mutable path after mount", () => {
    expect(() => {
        // harness mounts Route then mutates path
    }).toThrow("Route path cannot change after mount");
});
```

- [ ] **Step 2: Run the route component tests to verify they fail**

Run: `bun test src/route/tests/route-component.test.ts`
Expected: fail until the shell is rewritten around the extracted helpers.

- [ ] **Step 3: Move `Route.svelte` onto the new helpers and remove direct runtime state manipulation**

```svelte
<script lang="ts">
    import { getCurrentSearch, getMatchedRouteId, registerRoute, subscribeRuntime } from "./runtime.ts";
    import { decodeRouteProps } from "./query.ts";
    import { isPromiseLike, resolveLazyRouteComponent, validateRouteConfig } from "./validation.ts";
</script>
```

- [ ] **Step 4: Run the route component tests to verify they pass**

Run: `bun test src/route/tests/route-component.test.ts src/route/tests/export-surface.test.ts`
Expected: pass.

### Task 6: Restore and narrow test coverage

**Files:**
- Add: `src/route/tests/*.test.ts`
- Modify: `tests/package-policy.test.ts`
- Modify: `tests/package-exports.test.ts`

**Interfaces:**
- Consumes: public route API and extracted internal helpers
- Produces: route regression coverage for public behavior and internal safety boundaries

- [ ] **Step 1: Recreate the missing route tests around public behavior**

```ts
test("route navigation helpers keep query and hash behavior stable", () => {
    // routePush('?x=1') preserves current hash
});
```

- [ ] **Step 2: Run the full route test set**

Run: `bun test src/route/tests`
Expected: all route tests pass.

- [ ] **Step 3: Update root package policy checks to reflect the final route surface**

```ts
expect("initRouteSystem" in route).toBe(false);
expect("registerRoute" in route).toBe(false);
```

- [ ] **Step 4: Run repository policy tests**

Run: `bun test tests/package-exports.test.ts tests/package-policy.test.ts`
Expected: pass.

### Task 7: Refresh route README to match the final API

**Files:**
- Modify: `src/route/README.md`

**Interfaces:**
- Consumes: final public route API
- Produces: updated usage docs and behavior notes

- [ ] **Step 1: Update the README examples to match the final public surface**

```svelte
<script lang="ts">
  import { Route, routePush } from 'svelte-lib/route';
</script>
```

- [ ] **Step 2: Run a docs consistency check by reading the updated file**

Run: `sed -n '1,260p' src/route/README.md`
Expected: examples and export list match the implementation.
