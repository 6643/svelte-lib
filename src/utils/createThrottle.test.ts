import { afterEach, describe, expect, it, vi } from "vite-plus/test";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
import { createThrottle } from "./createThrottle.ts";

describe("createThrottle", () => {
  it("首次立即执行, 窗口内忽略, 窗口后放行", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const throttled = createThrottle(fn, 100);

    throttled("a");
    throttled("b");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenLastCalledWith("a");

    vi.advanceTimersByTime(100);
    throttled("c");
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenLastCalledWith("c");
  });
});

describe("createThrottle cancel", () => {
  it("cancel 后立即可再次执行", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const throttled = createThrottle(fn, 100);

    throttled("a");
    expect(fn).toHaveBeenCalledTimes(1);

    throttled.cancel();
    throttled("b");
    expect(fn).toHaveBeenCalledTimes(2);

    vi.useRealTimers();
  });
});
