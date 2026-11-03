import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { createDebounce } from "./createDebounce.ts";

afterEach(() => {
  vi.useRealTimers();
});

describe("createDebounce", () => {
  it("窗口内连续调用只执行最后一次", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = createDebounce(fn, 100);

    debounced("a");
    debounced("b");
    debounced("c");
    expect(fn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenLastCalledWith("c");
  });

  it("cancel 后不再触发", () => {
    vi.useFakeTimers();
    const fn = vi.fn();
    const debounced = createDebounce(fn, 100);

    debounced();
    debounced.cancel();
    vi.advanceTimersByTime(500);

    expect(fn).not.toHaveBeenCalled();
  });
});
