import type { RoutePort } from "../../src/route.svelte.ts";

type Listener = (event?: unknown) => void;

// 假浏览器端口: 只实现 route.svelte.ts 用到的表面.
// 事件通过 emit 手动触发, 调用通过 calls 观测, 监听器数量用 listenerCount 断言成对摘除.
export const createFakePort = (path = "/", state: unknown = null) => {
  const listeners = new Map<string, Listener[]>();
  const calls = { scrollTo: [] as Array<[number, number]>, storage: {} as Record<string, string> };
  const url = () => new URL(path, "https://example.test");

  const add = (key: string, listener: Listener) => {
    listeners.set(key, [...(listeners.get(key) ?? []), listener]);
  };
  const remove = (key: string, listener: Listener) => {
    listeners.set(
      key,
      (listeners.get(key) ?? []).filter((item) => item !== listener),
    );
  };

  const port = {
    location: {
      get pathname() {
        return url().pathname;
      },
      get search() {
        return url().search;
      },
      get hash() {
        return url().hash;
      },
      origin: "https://example.test",
      get href() {
        return url().href;
      },
    },
    history: {
      get state() {
        return state;
      },
      set state(next: unknown) {
        state = next;
      },
      scrollRestoration: "auto" as "auto" | "manual",
      pushState: (nextState: unknown, _unused: string, next: string) => {
        state = nextState;
        path = next;
      },
      replaceState: (nextState: unknown, _unused: string, next: string) => {
        state = nextState;
        path = next;
      },
    },
    scrollY: 0,
    scrollTo: (x: number, y: number) => {
      calls.scrollTo.push([x, y]);
    },
    addEventListener: (type: string, listener: Listener) => add(type, listener),
    removeEventListener: (type: string, listener: Listener) => remove(type, listener),
    document: {
      addEventListener: (type: string, listener: Listener) => add(`document:${type}`, listener),
      removeEventListener: (type: string, listener: Listener) =>
        remove(`document:${type}`, listener),
    },
    sessionStorage: {
      getItem: (key: string) => calls.storage[key] ?? null,
      setItem: (key: string, value: string) => {
        calls.storage[key] = value;
      },
    },
    emit: (type: string, event?: unknown) => {
      for (const listener of listeners.get(type) ?? []) listener(event);
    },
    listenerCount: (type: string) => (listeners.get(type) ?? []).length,
    calls,
  };

  return port as typeof port & RoutePort;
};
