import { afterEach, describe, expect, it, vi } from "vite-plus/test";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
import { tick } from "svelte";
import { render } from "@testing-library/svelte";
import SignalProbe from "../../test/fixtures/SignalProbe.svelte";
import CopyProbe from "../../test/fixtures/CopyProbe.svelte";
import WakeProbe from "../../test/fixtures/WakeProbe.svelte";
import { createTry } from "./createTry.svelte.ts";
import { createStorage } from "./createStorage.svelte.ts";

describe("createTry", () => {
  it("同步抛错与 rejected promise 都进 errors 且不外抛", async () => {
    const store = createTry();
    const boom = store.tryCatch(() => {
      throw new Error("sync");
    }, "boom");
    const reject = store.tryCatch(() => Promise.reject(new Error("async")), "reject");

    await expect(boom()).resolves.toBeUndefined();
    await expect(reject()).resolves.toBeUndefined();

    expect(store.errors.map((entry) => entry.info)).toEqual(["sync", "async"]);
    expect(store.errors[0]?.fnName).toBe("boom");

    store.clearErrors();
    expect(store.errors).toEqual([]);
  });
});

describe("createStorage", () => {
  it("读写 localStorage, 缺省值可回退", () => {
    localStorage.clear();

    const store = createStorage("test:key", { count: 1 });
    expect(store.value).toEqual({ count: 1 });

    store.value = { count: 3 };
    expect(JSON.parse(localStorage.getItem("test:key") ?? "null")).toEqual({ count: 3 });

    store.update((prev) => ({ count: prev.count + 1 }));
    expect(store.value).toEqual({ count: 4 });
  });

  it("update 解构后仍可调用", () => {
    localStorage.clear();
    const store = createStorage("test:destructure", { count: 1 });
    // 解构正是本用例的被测行为: update 不得依赖 this 绑定
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const { update } = store;

    update((prev) => ({ count: prev.count + 10 }));

    expect(store.value).toEqual({ count: 11 });
    expect(JSON.parse(localStorage.getItem("test:destructure") ?? "null")).toEqual({ count: 11 });
  });
});

describe("createCopy", () => {
  it("调用 clipboard.writeText 并在 2 秒后回落", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn(async () => {});
    vi.stubGlobal("navigator", {
      clipboard: { writeText, write: vi.fn() },
      wakeLock: undefined,
    });

    const { container } = render(CopyProbe, {});
    (container.querySelector(".copy") as HTMLButtonElement).click();
    // copy() 是异步的: 先等它内部的 await 链走完, 再等 DOM 刷新
    await Promise.resolve();
    await tick();

    expect(writeText).toHaveBeenCalledWith("hello");
    expect(container.querySelector(".copied")?.textContent).toBe("true");

    await vi.advanceTimersByTimeAsync(2000);
    await tick();
    expect(container.querySelector(".copied")?.textContent).toBe("false");
  });

  it("卸载后待复位的定时器被清掉", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn(async () => {}), write: vi.fn() },
      wakeLock: undefined,
    });

    const { container, unmount } = render(CopyProbe, {});
    (container.querySelector(".copy") as HTMLButtonElement).click();
    // copy() 是异步的: 先等它内部的 await 链走完, 再等 DOM 刷新
    await Promise.resolve();
    await tick();
    // 让 testing-library 自己的瞬时定时器先跑完, 剩下的才是 createCopy 的复位定时器
    await vi.advanceTimersByTimeAsync(100);
    expect(vi.getTimerCount()).toBe(1);

    unmount();
    expect(vi.getTimerCount()).toBe(0);

    // 推进时钟不应抛错 (定时器已清, 不会再写已销毁组件的 state)
    await vi.advanceTimersByTimeAsync(3000);
  });

  it("卸载时写入仍未完成, 不会在之后留下定时器", async () => {
    vi.useFakeTimers();
    let resolveWrite: () => void = () => {};
    const pending = new Promise<void>((resolve) => {
      resolveWrite = resolve;
    });
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn(() => pending), write: vi.fn() },
      wakeLock: undefined,
    });

    const { container, unmount } = render(CopyProbe, {});
    (container.querySelector(".copy") as HTMLButtonElement).click();
    await tick();

    // 卸载时剪贴板写入还没完成, 复位定时器尚未创建
    unmount();
    // 先让 testing-library 自己的瞬时定时器跑完, 剩下的才算 createCopy 的
    await vi.advanceTimersByTimeAsync(100);
    expect(vi.getTimerCount()).toBe(0);

    // 写入在卸载之后才 resolve: 不得再建定时器
    resolveWrite();
    await Promise.resolve();
    await Promise.resolve();
    await tick();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("signal hooks", () => {
  it("createDebouncedSignal 合并变化后再更新", async () => {
    vi.useFakeTimers();
    const { container, rerender } = render(SignalProbe, { props: { source: "a" } });

    expect(container.querySelector(".debounced")?.textContent).toBe("a");

    await rerender({ source: "b" });
    await rerender({ source: "c" });
    expect(container.querySelector(".debounced")?.textContent).toBe("a");

    await vi.advanceTimersByTimeAsync(100);
    await Promise.resolve();
    expect(container.querySelector(".debounced")?.textContent).toBe("c");
  });

  it("createMediaQuery 跟随 matchMedia 的 change", async () => {
    // svelte/reactivity 的 MediaQuery 用 svelte 的 on() 订阅, 必须是真 EventTarget
    const mql = new EventTarget() as EventTarget & { matches: boolean };
    mql.matches = false;
    vi.stubGlobal("matchMedia", () => mql);

    const { container } = render(SignalProbe, {});

    await tick();
    expect(container.querySelector(".matches")?.textContent).toBe("false");

    mql.matches = true;
    mql.dispatchEvent(new Event("change"));
    await tick();
    expect(container.querySelector(".matches")?.textContent).toBe("true");
  });

  it("createFullscreen 跟随 fullscreenchange", async () => {
    const { container } = render(SignalProbe, {});

    expect(container.querySelector(".fullscreen")?.textContent).toBe("false");

    Object.defineProperty(document, "fullscreenElement", {
      value: document.documentElement,
      configurable: true,
    });
    document.dispatchEvent(new Event("fullscreenchange"));
    await tick();
    expect(container.querySelector(".fullscreen")?.textContent).toBe("true");

    Object.defineProperty(document, "fullscreenElement", {
      value: null,
      configurable: true,
    });
    document.dispatchEvent(new Event("fullscreenchange"));
    await tick();
    expect(container.querySelector(".fullscreen")?.textContent).toBe("false");
  });
});

describe("createWakeLock", () => {
  it("不支持时 supported 为 false, setActive 不抛错", async () => {
    vi.stubGlobal("navigator", {});

    expect(() => render(SignalProbe, {})).not.toThrow();
  });

  it("支持时申请 screen 锁", async () => {
    const release = vi.fn(async () => {});
    const sentinel = { released: false, release, addEventListener: () => {} };
    const request = vi.fn(async () => sentinel);
    vi.stubGlobal("navigator", { wakeLock: { request } });

    render(WakeProbe, {});
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(request).toHaveBeenCalledWith("screen");
  });
});
