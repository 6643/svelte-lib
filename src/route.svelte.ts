import type { Component } from "svelte";
import { SvelteMap } from "svelte/reactivity";

// 轻量静态路由: 路径只有静态字符串, 参数只走 query string, 滚动只记窗口位置.
//
// 与 solid 版 `Route.ts` 一一对应; 差别只在框架绑定层:
// - solid 的 `createSignal` -> 模块级 `$state` (因此文件名为 `*.svelte.ts`)
// - solid 的 `Accessor<T>` -> `() => T` (Svelte 里读 `$state` 的闭包天然是响应式的)
// - solid 的 `<Route>` 返回 accessor -> `Route.svelte` 组件 (见下)
//
// 本模块顶层零副作用: 浏览器对象一律经 ensureRouteState() 惰性获取.

// 浏览器位置快照 (只读, 由 ensureRouteState 维护).
export type RouteLocation = {
  readonly pathname: string;
  readonly search: string;
  readonly hash: string;
  readonly origin: string;
  readonly href: string;
};

// 路由依赖的最小浏览器表面. 生产环境由 globalThis 提供, 测试注入假实现,
// 这样滚动与导航状态机可以在无 DOM 的环境里被行为测试覆盖.
export type RoutePort = {
  readonly location: RouteLocation;
  readonly history: {
    state: unknown;
    scrollRestoration: "auto" | "manual";
    pushState: (state: unknown, unused: string, url: string) => void;
    replaceState: (state: unknown, unused: string, url: string) => void;
  };
  readonly scrollY: number;
  scrollTo: (x: number, y: number) => void;
  addEventListener: (type: string, listener: (event?: unknown) => void) => void;
  removeEventListener: (type: string, listener: (event?: unknown) => void) => void;
  readonly document: {
    addEventListener: (type: string, listener: (event: unknown) => void) => void;
    removeEventListener: (type: string, listener: (event: unknown) => void) => void;
  };
  readonly sessionStorage: {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
  };
  readonly performance?: { getEntriesByType?: (type: string) => ReadonlyArray<{ type?: string }> };
  requestAnimationFrame?: (callback: () => void) => void;
};

// 兜底路由的 path 取值.
const FALLBACK_ROUTE_PATH = "/*";

// 归一化 pathname: percent-decode (非法编码保留原值) -> 补前导斜杠 ->
// 折叠重复斜杠 -> 去尾斜杠 (根除外).
export const normalizePathname = (pathname: string): string => {
  if (!pathname) return "/";

  let decoded = pathname;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    decoded = pathname;
  }

  const withLeading = decoded.startsWith("/") ? decoded : `/${decoded}`;
  const collapsed = withLeading.replace(/\/{2,}/g, "/");
  if (collapsed.length === 1) return collapsed;

  const trimmed = collapsed.replace(/\/+$/, "");
  return trimmed || "/";
};

// 只有 `/*` 是兜底路径.
export const isFallbackRoutePath = (path: string): boolean => path === FALLBACK_ROUTE_PATH;

// 精确匹配: 归一化后逐字比较, 大小写敏感, 兜底路径永不参与精确匹配.
export const matchesExactRoute = (path: string, pathname: string): boolean =>
  !isFallbackRoutePath(path) && normalizePathname(path) === normalizePathname(pathname);

const noop = (): void => {};

const EMPTY_LOCATION: RouteLocation = {
  pathname: "/",
  search: "",
  hash: "",
  origin: "",
  href: "",
};

// 单例状态: 当前端口, 解绑句柄, location 快照.
let port: RoutePort | null = null;
let detachRoute: (() => void) | null = null;
// 滚动监听 / 链接拦截的摘除逻辑压进这里, 由 detachRouteState 统一执行.
let unbindTasks: Array<() => void> = [];

// 路由状态是全局单例: 读取它 (readLocation / parseParam) 就是订阅导航.
let location = $state<RouteLocation>(EMPTY_LOCATION);
const setLocation = (next: RouteLocation): void => {
  location = next;
};

// 当前 location 快照; 读取它就是订阅导航.
export const readLocation = (): RouteLocation => location;

const snapshotOf = (source: RoutePort): RouteLocation => ({
  pathname: source.location.pathname,
  search: source.location.search,
  hash: source.location.hash,
  origin: source.location.origin,
  href: source.location.href,
});

// 惰性取 globalThis.window; 无浏览器或形状不符时返回 null (不抛错).
const resolveGlobalPort = (): RoutePort | null => {
  const candidate = (globalThis as { window?: Partial<RoutePort> }).window;
  if (!candidate?.location || !candidate.history || !candidate.document) return null;

  return candidate as RoutePort;
};

const detachRouteState = (): void => {
  const wasBound = port !== null;
  for (const unbind of unbindTasks) unbind();

  unbindTasks = [];
  port = null;
  detachRoute = null;
  // 从未绑定过就不要写快照: 少一次响应式写, 也少一次无意义的重算.
  if (wasBound) setLocation(EMPTY_LOCATION);
};

// 绑定浏览器端口并挂上路由状态机. 幂等: 同一端口重复调用返回同一个解绑函数.
// 传 null 表示解绑并回到无浏览器状态; 无参数时自动取 globalThis.window.
//
// 与 solid 版的差异: 无参数调用在已绑定任意端口时直接返回既有句柄 (惰性初始化, 不重绑),
// 这样测试注入的假端口不会被 globalThis.window 顶掉. 显式传端口仍然是重绑语义.
export const ensureRouteState = (next?: RoutePort | null): (() => void) => {
  if (next === null) {
    detachRouteState();
    return noop;
  }
  if (next === undefined && port && detachRoute) return detachRoute;

  const source = next ?? resolveGlobalPort();
  if (!source) return noop;
  if (port === source && detachRoute) return detachRoute;

  detachRouteState();
  port = source;
  setLocation(snapshotOf(source));
  bindRouteListeners(source);
  detachRoute = detachRouteState;

  return detachRoute;
};

const TRUE_VALUES = ["1", "on", "true", "yes"];
const FALSE_VALUES = ["0", "false", "no", "off"];

const readParamValue = (name: string): string | null =>
  new URLSearchParams(readLocation().search).get(name);

const parseBooleanParam = (raw: string | null, fallback: boolean): boolean => {
  if (raw === null) return fallback;

  const value = raw.toLowerCase();
  if (TRUE_VALUES.includes(value)) return true;
  if (FALSE_VALUES.includes(value)) return false;

  return fallback;
};

const parseNumberParam = (raw: string | null, fallback: number): number => {
  if (raw === null || raw.trim() === "") return fallback;

  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
};

export type ParamParser<T> = (raw: string | null) => T;
export type ParamFallback = boolean | number | string;

// 读一个 query 参数, 返回 accessor: 每次调用都按当前 search 重新解析.
// 布尔真值 1/on/true/yes, 假值 0/false/no/off, 其它取 fallback;
// 数字非有限值取 fallback; 缺键时自定义 parser 收到 null.
export function parseParam(name: string, fallback: string): () => string;
export function parseParam(name: string, fallback: number): () => number;
export function parseParam(name: string, fallback: boolean): () => boolean;
export function parseParam<T>(name: string, parser: ParamParser<T>): () => T;
export function parseParam(
  name: string,
  parserOrFallback: ParamFallback | ParamParser<unknown>,
): () => unknown {
  ensureRouteState();

  const read = (): unknown => {
    const raw = readParamValue(name);
    if (typeof parserOrFallback === "function") return parserOrFallback(raw);
    if (typeof parserOrFallback === "boolean") return parseBooleanParam(raw, parserOrFallback);
    if (typeof parserOrFallback === "number") return parseNumberParam(raw, parserOrFallback);

    return raw ?? parserOrFallback;
  };

  return read;
}

export type ParamSchema = Record<string, ParamParser<unknown>>;
export type ParsedParams<T extends ParamSchema> = { readonly [K in keyof T]: ReturnType<T[K]> };

// 按 schema 批量解析, 每个键一个 accessor.
export const parseParams = <T extends ParamSchema>(
  schema: T,
): { readonly [K in keyof T]: () => ParsedParams<T>[K] } => {
  ensureRouteState();

  const accessors = Object.entries(schema).map(
    ([key, parser]) => [key, () => parser(readParamValue(key))] as const,
  );

  return Object.fromEntries(accessors) as { readonly [K in keyof T]: () => ParsedParams<T>[K] };
};

// 一个已挂载的路由块. 条件渲染由调用方用 `{#if}` 表达, 没挂载就不在表里.
export type RegisteredRoute = {
  path: string;
  fallback: boolean;
};

// SvelteMap: 增删本身即响应式, 不再需要版本号把变化"手动喂"给派生值
const registry = new SvelteMap<symbol, RegisteredRoute>();

// 注册一个路由块, 返回用于注销的 id. 非兜底路径在入口归一化.
export const registerRoute = (route: RegisteredRoute): symbol => {
  const id = Symbol(route.path);
  registry.set(id, {
    path: route.fallback ? route.path : normalizePathname(route.path),
    fallback: route.fallback,
  });

  return id;
};

export const unregisterRoute = (id: symbol): void => {
  registry.delete(id);
};

// 是否存在"已挂载且精确匹配"的块. 每次调用都全表扫描, 不缓存:
// 条目数是个位数, 而缓存需要跟随挂载/卸载失效, 只会引入 bug.
export const hasActiveExactRoute = (pathname: string): boolean => {
  for (const route of registry.values()) {
    if (route.fallback) continue;
    if (matchesExactRoute(route.path, pathname)) return true;
  }

  return false;
};

// 兜底块判据: 当前 pathname 没有任何已挂载的精确匹配.
export const hasActiveFallbackRoute = (): boolean =>
  !hasActiveExactRoute(normalizePathname(readLocation().pathname));

// 仅供测试: 清空注册表.
export const resetRouteForTests = (): void => {
  registry.clear();
};

// 本库写进 history.state 的元数据. 与用户 state 合并, 不整体覆盖.
export type RouteHistoryState = {
  depth: number;
  backPath?: string;
};

// history.state 里的元数据键: 带命名空间, 避免与业务 state 撞键.
export const ROUTE_STATE_KEY = "__svelte_route__";

export const warnRoute = (message: string): void => {
  console.warn(`[svelte-lib/route] ${message}`);
};

// DOM 事件是类实例 (原型不是 Object.prototype), 不能用 isPlainObject 判断.
const isObjectLike = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== "object" || value === null) return false;

  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};

const readRouteHistoryState = (state: unknown): RouteHistoryState => {
  const meta = isPlainObject(state) ? state[ROUTE_STATE_KEY] : undefined;
  if (!isPlainObject(meta)) return { depth: 0 };

  const depth = typeof meta.depth === "number" && Number.isFinite(meta.depth) ? meta.depth : 0;
  const backPath = typeof meta.backPath === "string" ? meta.backPath : undefined;

  return backPath === undefined ? { depth } : { depth, backPath };
};

const mergeHistoryState = (base: unknown, meta: RouteHistoryState): Record<string, unknown> =>
  isPlainObject(base) ? { ...base, [ROUTE_STATE_KEY]: meta } : { [ROUTE_STATE_KEY]: meta };

const refreshLocation = (): void => {
  if (port) setLocation(snapshotOf(port));
};

// 校验并解析站内路径, 返回 pathname + search + hash.
// 跨源, 协议相对 (`//host`), 非 http(s) 协议一律抛错.
export const resolveInternalPath = (raw: string, origin: string): string => {
  if (raw.startsWith("//")) throw new Error(`不允许协议相对路径: ${raw}`);

  const url = new URL(raw, origin);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`不允许的协议: ${url.protocol}`);
  }
  if (url.origin !== origin) throw new Error(`不允许跨源导航: ${raw}`);

  return `${url.pathname}${url.search}${url.hash}`;
};

// 回到顶部并记下新 depth 的位置, 恢复引发的 scroll 不计为用户接管.
const resetScrollToTop = (): void => {
  const source = port;
  if (!source) return;

  programmatic = true;
  try {
    source.scrollTo(0, 0);
  } finally {
    programmatic = false;
  }
  positions.set(currentDepth(), 0);
};

// 压入一条历史记录: depth 递增, backPath 指回离开时的 pathname + search.
export const pushRoute = (path: string): void => {
  const current = port;
  if (!current) {
    warnRoute(`无浏览器环境, 忽略导航: ${path}`);
    return;
  }

  const next = resolveInternalPath(path, current.location.origin);
  const previous = readRouteHistoryState(current.history.state);
  const state = mergeHistoryState(current.history.state, {
    depth: previous.depth + 1,
    backPath: `${current.location.pathname}${current.location.search}`,
  });

  current.history.pushState(state, "", next);
  // 前进方向的记录已经失效; 新 entry 从顶部开始.
  pruneScroll(previous.depth + 1);
  refreshLocation();
  resetScrollToTop();
};

// 替换当前历史记录: 继承 depth 与既有 backPath.
export const replaceRoute = (path: string): void => {
  const current = port;
  if (!current) {
    warnRoute(`无浏览器环境, 忽略导航: ${path}`);
    return;
  }

  const next = resolveInternalPath(path, current.location.origin);
  const previous = readRouteHistoryState(current.history.state);
  const meta: RouteHistoryState =
    previous.backPath === undefined
      ? { depth: previous.depth }
      : { depth: previous.depth, backPath: previous.backPath };

  current.history.replaceState(mergeHistoryState(current.history.state, meta), "", next);
  refreshLocation();
};

// 当前记录的返回路径; 缺失或非法 (旧数据) 时返回 null.
export const getRouteBackPath = (): string | null => {
  const current = port;
  if (!current) return null;

  const { backPath } = readRouteHistoryState(current.history.state);
  if (backPath === undefined) return null;

  try {
    return resolveInternalPath(backPath, current.location.origin);
  } catch {
    return null;
  }
};

export const SCROLL_STORAGE_KEY = "svelte-route:scroll";

// 窗口滚动位置按 history entry 的 depth 记: 同一 pathname 可以有多条历史记录.
const positions = new Map<number, number>();
let storedDepth = 0;
let pendingDepth: number | null = null;
// 目标位置在标记时就快照下来: 浏览器自己的恢复滚动可能在我们的帧之前改写位置表.
let pendingY: number | undefined;
// 恢复引发的 scroll 不能判成用户接管.
let programmatic = false;

const currentDepth = (): number => readRouteHistoryState(port?.history.state).depth;

// 记录当前 depth 的窗口位置. 只在 scroll 事件里写, 不在离开时读.
export const recordScroll = (y: number): void => {
  if (!port) return;

  positions.set(currentDepth(), y);
};

// 剪掉前进方向的记录: push 之后 depth >= 新 depth 的历史不会再被回到.
export const pruneScroll = (fromDepth: number): void => {
  // Map 迭代期间删除键是安全的: 被删的键不会再被访问到
  for (const depth of positions.keys()) {
    if (depth >= fromDepth) positions.delete(depth);
  }
};

// 标记一次待恢复: pop / bfcache / reload 到达后调用.
export const markTraversal = (depth: number): void => {
  pendingDepth = Number.isFinite(depth) ? depth : null;
  pendingY = pendingDepth === null ? undefined : positions.get(pendingDepth);
  if (pendingDepth === null) return;

  const source = port;
  if (!source) return;
  if (source.requestAnimationFrame) {
    source.requestAnimationFrame(() => restoreScroll());
    return;
  }
  queueMicrotask(() => restoreScroll());
};

// 恢复待恢复位置, 每次只滚一次; 无端口或无目标时立即返回 (含已解绑的迟到调度).
export const restoreScroll = (): void => {
  const source = port;
  const y = pendingY;
  if (!source || pendingDepth === null) return;

  pendingDepth = null;
  pendingY = undefined;
  if (y === undefined) return;

  programmatic = true;
  try {
    source.scrollTo(0, y);
  } finally {
    programmatic = false;
  }
};

// 从 sessionStorage 读回上次的位置表; 损坏或旧结构一律当作空表.
const readStoredScroll = (source: RoutePort): void => {
  positions.clear();
  storedDepth = 0;

  let raw: string | null = null;
  try {
    raw = source.sessionStorage.getItem(SCROLL_STORAGE_KEY);
  } catch {
    return;
  }
  if (!raw) return;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isPlainObject(parsed)) return;

    if (typeof parsed.depth === "number" && Number.isFinite(parsed.depth)) {
      storedDepth = parsed.depth;
    }
    if (!isPlainObject(parsed.positions)) return;

    for (const [key, value] of Object.entries(parsed.positions)) {
      const depth = Number(key);
      if (!Number.isFinite(depth)) continue;
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      positions.set(depth, value);
    }
  } catch {
    positions.clear();
    storedDepth = 0;
  }
};

// 首屏只在 reload / back_forward 时恢复; 正常导航不抢用户位置.
const armInitialRestore = (source: RoutePort): void => {
  readStoredScroll(source);

  const type = source.performance?.getEntriesByType?.("navigation")?.[0]?.type;
  if (type !== "reload" && type !== "back_forward") return;

  markTraversal(storedDepth > 0 ? storedDepth : currentDepth());
};

// scroll 只记录位置: 浏览器自己的恢复滚动也会派发 scroll, 不能拿它当"用户接管"的证据.
const onScrollEvent = (): void => {
  const source = port;
  if (!source || programmatic) return;

  positions.set(currentDepth(), source.scrollY);
};

// 真实用户意图 (滚轮 / 触摸 / 键盘) 才取消待恢复.
const onUserIntentEvent = (): void => {
  pendingDepth = null;
  pendingY = undefined;
};

const onPopStateEvent = (event?: unknown): void => {
  if (!port) return;

  const state = isObjectLike(event) ? event.state : undefined;
  refreshLocation();
  markTraversal(readRouteHistoryState(state).depth);
};

const onPageShowEvent = (event?: unknown): void => {
  const source = port;
  if (!source) return;

  const persisted = isObjectLike(event) && event.persisted === true;
  if (!persisted) return;

  readStoredScroll(source);
  markTraversal(currentDepth());
};

const onPageHideEvent = (): void => {
  const source = port;
  if (!source) return;

  try {
    source.sessionStorage.setItem(
      SCROLL_STORAGE_KEY,
      JSON.stringify({ depth: currentDepth(), positions: Object.fromEntries(positions) }),
    );
  } catch {
    // 存储不可用 (隐私模式 / 配额) 时放弃持久化, 不影响导航.
  }
};

// 挂上路由状态机的监听 (窗口滚动 + 文档级链接拦截);
// 摘除逻辑压进 unbindTasks, 由 detachRouteState 统一执行.
const bindRouteListeners = (source: RoutePort): void => {
  source.history.scrollRestoration = "manual";

  const listeners: Array<[string, (event?: unknown) => void]> = [
    ["scroll", onScrollEvent],
    ["popstate", onPopStateEvent],
    ["pageshow", onPageShowEvent],
    ["pagehide", onPageHideEvent],
    ["wheel", onUserIntentEvent],
    ["touchstart", onUserIntentEvent],
    ["keydown", onUserIntentEvent],
  ];

  for (const [type, listener] of listeners) {
    source.addEventListener(type, listener);
    unbindTasks.push(() => source.removeEventListener(type, listener));
  }

  source.document.addEventListener("click", onDocumentClick);
  unbindTasks.push(() => source.document.removeEventListener("click", onDocumentClick));

  armInitialRestore(source);
};

// 上次会话落盘的 depth; 无存储或损坏时为 0.
export const readScrollDepth = (): number => storedDepth;

type ClickLike = {
  defaultPrevented?: boolean;
  button?: number;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  target?: unknown;
  preventDefault?: () => void;
};

type AnchorLike = {
  getAttribute?: (name: string) => string | null;
  href?: string;
  download?: string;
  target?: string;
};

// 文档级链接拦截: 只接管"修饰键未按下 / 主键 / 站内 http(s) 绝对或相对链接".
// 其余 (新窗口, 下载, 页内锚点, 跨源) 一律交回浏览器.
const onDocumentClick = (event?: unknown): void => {
  if (!isObjectLike(event)) return;

  const click = event as ClickLike;
  if (click.defaultPrevented) return;
  if (click.button !== 0) return;
  if (click.altKey || click.ctrlKey || click.metaKey || click.shiftKey) return;

  const target = click.target as { closest?: (selector: string) => unknown } | undefined;
  if (typeof target?.closest !== "function") return;

  const anchor = target.closest("a[href]") as AnchorLike | null;
  if (!anchor) return;

  const rawHref =
    typeof anchor.getAttribute === "function" ? anchor.getAttribute("href") : anchor.href;
  if (!rawHref || rawHref.startsWith("#")) return;
  if (anchor.download) return;
  if (anchor.target && anchor.target !== "_self") return;

  try {
    pushRoute(rawHref);
  } catch {
    warnRoute(`忽略无法路由的链接: ${rawHref}`);
    return;
  }

  click.preventDefault?.();
};

// 含冒号 (动态段) 或非法通配的路径: 只告警, 永不匹配.
export const isUnsupportedRoutePath = (path: string): boolean =>
  path.includes(":") || (path.includes("*") && !isFallbackRoutePath(path));

// 路由块契约 (与 solid 的 `RouteProps` 对应, 由 `Route.svelte` 实现).
export type RouteProps = {
  path: string;
  component: Component<Record<string, never>>;
};
