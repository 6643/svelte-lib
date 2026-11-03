import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { createFakePort } from "../test/fixtures/routePort.ts";
import {
  ensureRouteState,
  getRouteBackPath,
  hasActiveExactRoute,
  hasActiveFallbackRoute,
  isFallbackRoutePath,
  matchesExactRoute,
  markTraversal,
  normalizePathname,
  parseParam,
  parseParams,
  pruneScroll,
  pushRoute,
  readLocation,
  readScrollDepth,
  recordScroll,
  registerRoute,
  replaceRoute,
  resetRouteForTests,
  resolveInternalPath,
  restoreScroll,
  ROUTE_STATE_KEY,
  SCROLL_STORAGE_KEY,
  unregisterRoute,
} from "./route.svelte.ts";

// 每个用例后复位: 路由是进程级单例
afterEach(() => {
  ensureRouteState(null);
  resetRouteForTests();
  vi.restoreAllMocks();
});

describe("纯函数", () => {
  it("normalizePathname 解码, 折叠斜杠, 去尾斜杠", () => {
    expect(normalizePathname("")).toBe("/");
    expect(normalizePathname("/")).toBe("/");
    expect(normalizePathname("/abc/")).toBe("/abc");
    expect(normalizePathname("abc")).toBe("/abc");
    expect(normalizePathname("/a//b///")).toBe("/a/b");
    expect(normalizePathname("/a%20b")).toBe("/a b");
    // 非法编码保留原值
    expect(normalizePathname("/bad%E0%A4%A")).toBe("/bad%E0%A4%A");
  });

  it("matchesExactRoute 逐字比较, 大小写敏感, 兜底路径永不精确匹配", () => {
    expect(matchesExactRoute("/abc", "/abc/")).toBe(true);
    expect(matchesExactRoute("/a//b", "/a/b")).toBe(true);
    expect(matchesExactRoute("/Abc", "/abc")).toBe(false);
    expect(matchesExactRoute("/*", "/*")).toBe(false);
    expect(isFallbackRoutePath("/*")).toBe(true);
    expect(isFallbackRoutePath("*")).toBe(false);
  });

  it("resolveInternalPath 拒绝跨源 / 协议相对 / 非 http(s)", () => {
    expect(resolveInternalPath("/ok?x=1#h", "https://example.test")).toBe("/ok?x=1#h");

    for (const bad of [
      "https://evil.test/x",
      "//evil.test/x",
      "javascript:alert(1)",
      "data:text/html,x",
    ]) {
      expect(() => resolveInternalPath(bad, "https://example.test")).toThrow();
    }
  });
});

describe("query 参数", () => {
  it("parseParam 支持回落值, 布尔别名与自定义 parser", () => {
    const detach = ensureRouteState(
      createFakePort("/x?page=3&enabled=yes&flag=1&name=&bad=Infinity"),
    );

    expect(parseParam("page", 1)()).toBe(3);
    expect(parseParam("missing", 7)()).toBe(7);
    expect(parseParam("bad", 7)()).toBe(7);
    // 空串是有效值, 不回落
    expect(parseParam("name", "d")()).toBe("");
    expect(parseParam("enabled", false)()).toBe(true);
    expect(parseParam("flag", false)()).toBe(true);
    expect(parseParam("off", true)()).toBe(true);
    expect(parseParam("off", (raw) => (raw === null ? "none" : raw))()).toBe("none");
    expect(parseParam("page", String)()).toBe("3");

    detach();
  });

  it("重复键保留第一个值", () => {
    const detach = ensureRouteState(createFakePort("/x?tag=a&tag=b"));

    expect(parseParam("tag", "")()).toBe("a");

    detach();
  });

  it("parseParams 每个键一个 accessor", () => {
    const detach = ensureRouteState(createFakePort("/x?page=2&enabled=0"));
    const params = parseParams({
      page: (raw) => Number(raw ?? 1),
      enabled: (raw) => raw === "true",
    });

    expect(params.page()).toBe(2);
    expect(params.enabled()).toBe(false);

    detach();
  });
});

describe("端口与注册表", () => {
  it("ensureRouteState 幂等, 解绑后快照清空", () => {
    const port = createFakePort("/x?a=1");
    const detach = ensureRouteState(port);

    expect(ensureRouteState(port)).toBe(detach);
    expect(readLocation().search).toBe("?a=1");

    detach();
    expect(readLocation().search).toBe("");
  });

  it("同一路径三个块都参与匹配, 兜底跟随注册表", () => {
    const detach = ensureRouteState(createFakePort("/abc"));

    const first = registerRoute({ path: "/abc", fallback: false });
    const second = registerRoute({ path: "/abc/", fallback: false });
    const third = registerRoute({ path: "/abc", fallback: false });
    const fallback = registerRoute({ path: "/*", fallback: true });

    expect(hasActiveExactRoute("/abc")).toBe(true);
    expect(hasActiveFallbackRoute()).toBe(false);

    // 注销两个 '/abc' 块后仍剩 third, 兜底不接手
    unregisterRoute(first);
    unregisterRoute(second);
    expect(hasActiveExactRoute("/abc")).toBe(true);
    expect(hasActiveFallbackRoute()).toBe(false);

    // 最后一个精确块也注销, 兜底接手
    unregisterRoute(third);
    expect(hasActiveExactRoute("/abc")).toBe(false);
    expect(hasActiveFallbackRoute()).toBe(true);

    unregisterRoute(fallback);
    detach();
    expect(hasActiveFallbackRoute()).toBe(true);
  });
});

describe("导航", () => {
  it("pushRoute 写 depth + backPath, replaceRoute 继承两者", () => {
    const port = createFakePort("/start");
    const pushed: Array<{ state: unknown; url: string }> = [];
    port.history.pushState = (state, _unused, url) => {
      port.history.state = state;
      pushed.push({ state, url });
    };
    port.history.replaceState = (state) => {
      port.history.state = state;
    };
    const detach = ensureRouteState(port);

    pushRoute("/next?page=2");
    expect(pushed.at(-1)?.url).toBe("/next?page=2");
    expect((port.history.state as Record<string, never>)[ROUTE_STATE_KEY]).toMatchObject({
      depth: 1,
      backPath: "/start",
    });
    expect(getRouteBackPath()).toBe("/start");

    replaceRoute("/other");
    expect((port.history.state as Record<string, never>)[ROUTE_STATE_KEY]).toMatchObject({
      depth: 1,
      backPath: "/start",
    });
    expect(getRouteBackPath()).toBe("/start");

    detach();
    expect(getRouteBackPath()).toBe(null);
  });

  it("非法链接不写历史记录", () => {
    const port = createFakePort("/start");
    let writes = 0;
    port.history.pushState = () => {
      writes += 1;
    };
    const detach = ensureRouteState(port);

    for (const bad of [
      "https://evil.test/x",
      "//evil.test/x",
      "javascript:alert(1)",
      "data:text/html,x",
    ]) {
      expect(() => pushRoute(bad)).toThrow();
    }
    expect(writes).toBe(0);

    detach();
  });

  it("无浏览器时告警且不抛错", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(() => pushRoute("/silent")).not.toThrow();
    expect(warn.mock.calls.some((line) => String(line[0]).includes("/silent"))).toBe(true);
  });
});

describe("滚动恢复", () => {
  it("pop 只恢复一次", () => {
    const port = createFakePort("/list", { [ROUTE_STATE_KEY]: { depth: 2 } });
    const detach = ensureRouteState(port);

    port.scrollY = 640;
    port.emit("scroll");
    port.emit("popstate", { state: { [ROUTE_STATE_KEY]: { depth: 2 } } });
    restoreScroll();
    restoreScroll();
    expect(port.calls.scrollTo).toEqual([[0, 640]]);

    detach();
    expect(port.listenerCount("scroll")).toBe(0);
    expect(port.listenerCount("popstate")).toBe(0);
  });

  it("用户输入取消待恢复", () => {
    const port = createFakePort("/list", { [ROUTE_STATE_KEY]: { depth: 1 } });
    const detach = ensureRouteState(port);
    recordScroll(500);

    port.emit("popstate", { state: { [ROUTE_STATE_KEY]: { depth: 1 } } });
    port.scrollY = 12;
    port.emit("wheel");
    restoreScroll();
    expect(port.calls.scrollTo).toEqual([]);

    detach();
  });

  it("恢复期间的浏览器 scroll 既不改目标也不取消", () => {
    const port = createFakePort("/list", { [ROUTE_STATE_KEY]: { depth: 1 } });
    const detach = ensureRouteState(port);
    recordScroll(700);

    port.emit("popstate", { state: { [ROUTE_STATE_KEY]: { depth: 1 } } });
    // 浏览器自己把同一个 entry 滚到别处, 然后我们才拿到帧
    port.scrollY = 1012;
    port.emit("scroll");
    restoreScroll();
    expect(port.calls.scrollTo).toEqual([[0, 700]]);

    detach();
  });

  it("pruneScroll 丢前进位置, pagehide 落盘", () => {
    const port = createFakePort("/a", { [ROUTE_STATE_KEY]: { depth: 3 } });
    const detach = ensureRouteState(port);

    recordScroll(900);
    pruneScroll(3);
    markTraversal(3);
    restoreScroll();
    expect(port.calls.scrollTo).toEqual([]);

    recordScroll(300);
    port.emit("pagehide");
    expect(JSON.parse(port.calls.storage[SCROLL_STORAGE_KEY] ?? "{}")).toEqual({
      depth: 3,
      positions: { "3": 300 },
    });

    detach();
  });

  it("损坏的存储被忽略", () => {
    const port = createFakePort("/a");
    port.calls.storage[SCROLL_STORAGE_KEY] = "{not json";
    const detach = ensureRouteState(port);

    expect(readScrollDepth()).toBe(0);

    detach();
  });

  it("只有 reload / back_forward 首屏才预置恢复", () => {
    const port = createFakePort("/a", { [ROUTE_STATE_KEY]: { depth: 0 } });
    (port as unknown as { performance: unknown }).performance = {
      getEntriesByType: () => [{ type: "navigate" }],
    };
    const detach = ensureRouteState(port);

    restoreScroll();
    expect(port.calls.scrollTo).toEqual([]);

    detach();
  });

  it("pushRoute 剪掉前进位置并回到顶部", () => {
    const port = createFakePort("/a", { [ROUTE_STATE_KEY]: { depth: 1 } });
    const detach = ensureRouteState(port);

    recordScroll(120);
    port.history.state = { [ROUTE_STATE_KEY]: { depth: 2 } };
    recordScroll(500);
    port.history.state = { [ROUTE_STATE_KEY]: { depth: 1 } };

    pushRoute("/c");
    expect(port.calls.scrollTo).toEqual([[0, 0]]);

    port.emit("pagehide");
    expect(JSON.parse(port.calls.storage[SCROLL_STORAGE_KEY] ?? "{}").positions).toEqual({
      "1": 120,
      "2": 0,
    });

    detach();
  });
});

describe("链接拦截", () => {
  it("只接管站内普通左键链接", () => {
    const port = createFakePort("/start");
    const detach = ensureRouteState(port);
    const pushed: string[] = [];
    port.history.pushState = (_state, _unused, url) => {
      pushed.push(url);
    };

    const anchor = (href: string, extra: Record<string, unknown> = {}) => ({
      closest: (selector: string) =>
        selector === "a[href]" ? { getAttribute: () => href, href, ...extra } : null,
    });

    port.emit("document:click", { button: 0, target: anchor("/go") });
    // 修饰键
    port.emit("document:click", { button: 0, target: anchor("/ext"), metaKey: true });
    // 非主键
    port.emit("document:click", { button: 1, target: anchor("/middle") });
    // 页内锚点
    port.emit("document:click", { button: 0, target: anchor("#inpage") });
    // 跨源
    port.emit("document:click", { button: 0, target: anchor("https://evil.test/x") });

    expect(pushed).toEqual(["/go"]);

    detach();
  });

  it("DOM 风格的事件实例也能拦截并 preventDefault", () => {
    const port = createFakePort("/start");
    const detach = ensureRouteState(port);
    const pushed: string[] = [];
    port.history.pushState = (_state, _unused, url) => {
      pushed.push(url);
    };

    class FakeMouseEvent {
      button = 0;
      defaultPrevented = false;
      target: unknown;

      constructor(target: unknown) {
        this.target = target;
      }

      preventDefault() {
        this.defaultPrevented = true;
      }
    }

    const event = new FakeMouseEvent({ closest: () => ({ getAttribute: () => "/go" }) });
    port.emit("document:click", event);

    expect(pushed).toEqual(["/go"]);
    expect(event.defaultPrevented).toBe(true);

    detach();
  });

  it("DOM 风格的 popstate 事件也能触发恢复", () => {
    const port = createFakePort("/list", { [ROUTE_STATE_KEY]: { depth: 1 } });
    const detach = ensureRouteState(port);
    recordScroll(480);

    class FakePopStateEvent {
      state: unknown;

      constructor(state: unknown) {
        this.state = state;
      }
    }

    port.emit("popstate", new FakePopStateEvent({ [ROUTE_STATE_KEY]: { depth: 1 } }));
    restoreScroll();
    expect(port.calls.scrollTo).toEqual([[0, 480]]);

    detach();
  });
});

describe("<Route> 组件", () => {
  it("挂载时注册, 匹配时渲染精确块", async () => {
    const { render } = await import("@testing-library/svelte");
    const { default: RouteHost } = await import("../test/fixtures/RouteHost.svelte");
    const detach = ensureRouteState(createFakePort("/abc"));

    const { container } = render(RouteHost, { props: { path: "/abc" } });

    expect(container.querySelector(".exact")).not.toBeNull();
    expect(container.querySelector(".fallback")).toBeNull();
    expect(hasActiveExactRoute("/abc")).toBe(true);

    detach();
  });

  it("未匹配时只剩兜底块", async () => {
    const { render } = await import("@testing-library/svelte");
    const { default: RouteHost } = await import("../test/fixtures/RouteHost.svelte");
    const detach = ensureRouteState(createFakePort("/other"));

    const { container } = render(RouteHost, { props: { path: "/abc" } });

    expect(container.querySelector(".exact")).toBeNull();
    expect(container.querySelector(".fallback")).not.toBeNull();

    detach();
  });

  it("同路径的多个块同时渲染, 兜底隐藏", async () => {
    const { render } = await import("@testing-library/svelte");
    const { default: RouteHost } = await import("../test/fixtures/RouteHost.svelte");
    const detach = ensureRouteState(createFakePort("/abc"));

    const { container } = render(RouteHost, {
      props: { path: "/abc", withGated: true, gated: true },
    });

    expect(container.querySelector(".exact")).not.toBeNull();
    expect(container.querySelector(".gated")).not.toBeNull();
    expect(container.querySelector(".fallback")).toBeNull();

    detach();
  });

  it("调用方用 {#if} 挂载/卸载精确块, 兜底随之接手", async () => {
    const { render } = await import("@testing-library/svelte");
    const { default: RouteHost } = await import("../test/fixtures/RouteHost.svelte");
    const { tick } = await import("svelte");
    const detach = ensureRouteState(createFakePort("/abc"));

    const { container, rerender } = render(RouteHost, { props: { path: "/abc", mounted: true } });
    expect(container.querySelector(".exact")).not.toBeNull();
    expect(container.querySelector(".fallback")).toBeNull();

    // 卸载即注销, 兜底接手
    await rerender({ mounted: false });
    await tick();
    expect(container.querySelector(".exact")).toBeNull();
    expect(container.querySelector(".fallback")).not.toBeNull();

    // 重新挂载即重新注册
    await rerender({ mounted: true });
    await tick();
    expect(container.querySelector(".exact")).not.toBeNull();
    expect(container.querySelector(".fallback")).toBeNull();

    detach();
  });

  it("受控块未挂载时不参与匹配, 挂载后接管", async () => {
    const { render } = await import("@testing-library/svelte");
    const { default: RouteHost } = await import("../test/fixtures/RouteHost.svelte");
    const { tick } = await import("svelte");
    const detach = ensureRouteState(createFakePort("/abc"));

    // 只挂兜底: 无精确块
    const { container, rerender } = render(RouteHost, {
      props: { path: "/abc", mounted: false, withGated: true, gated: false },
    });
    expect(container.querySelector(".gated")).toBeNull();
    expect(container.querySelector(".fallback")).not.toBeNull();

    await rerender({ gated: true });
    await tick();
    expect(container.querySelector(".gated")).not.toBeNull();
    expect(container.querySelector(".fallback")).toBeNull();

    detach();
  });

  it("卸载时注销注册表条目", async () => {
    const { render } = await import("@testing-library/svelte");
    const { default: RouteHost } = await import("../test/fixtures/RouteHost.svelte");
    const detach = ensureRouteState(createFakePort("/abc"));

    const { unmount } = render(RouteHost, { props: { path: "/abc" } });
    expect(hasActiveExactRoute("/abc")).toBe(true);

    unmount();
    expect(hasActiveExactRoute("/abc")).toBe(false);

    detach();
  });
});
