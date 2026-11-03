import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { render } from "@testing-library/svelte";
import ScrollProbe from "../../test/fixtures/ScrollProbe.svelte";
import { delPos, getPos, setPos } from "./useKeepScroll.ts";
import { useLoadMore } from "./useLoadMore.ts";

afterEach(() => {
  vi.useRealTimers();
});

describe("setPos / getPos / delPos", () => {
  it("往返读写, 缺省 0, delPos 清整页", () => {
    setPos("home", "list", 120);
    expect(getPos("home", "list")).toBe(120);
    expect(getPos("home", "other")).toBe(0);
    expect(getPos("nope", "list")).toBe(0);

    delPos("home");
    expect(getPos("home", "list")).toBe(0);
  });
});

describe("useScrollEnd", () => {
  it("滚动停止后按 debounce 回调一次 scrollTop", async () => {
    vi.useFakeTimers();
    const hook = vi.fn();
    const { container } = render(ScrollProbe, { props: { mode: "scrollEnd", hook } });
    const probe = container.querySelector(".probe") as HTMLElement;

    probe.scrollTop = 80;
    probe.dispatchEvent(new Event("scroll"));
    probe.scrollTop = 160;
    probe.dispatchEvent(new Event("scroll"));
    expect(hook).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(40);
    expect(hook).toHaveBeenCalledTimes(1);
    expect(hook).toHaveBeenLastCalledWith(160);
  });
});

describe("createLoad + useLoadMore", () => {
  it("距底小于 threshold 时请求第 0 页, 成功后 page 递增", async () => {
    vi.useFakeTimers();
    const more = vi.fn(async () => true);
    const { container } = render(ScrollProbe, { props: { mode: "load", more } });
    const probe = container.querySelector(".probe-panel") as HTMLElement;

    probe.dispatchEvent(new Event("scroll"));
    await vi.advanceTimersByTimeAsync(40);

    expect(more).toHaveBeenCalledTimes(1);
    expect(more).toHaveBeenLastCalledWith(0, "args");
    expect(container.querySelector(".page")?.textContent).toBe("1");
  });

  it("more 返回 false 后不再请求", async () => {
    vi.useFakeTimers();
    const more = vi.fn(async () => false);
    const { container } = render(ScrollProbe, { props: { mode: "load", more } });
    const probe = container.querySelector(".probe-panel") as HTMLElement;

    probe.dispatchEvent(new Event("scroll"));
    await vi.advanceTimersByTimeAsync(40);
    expect(more).toHaveBeenCalledTimes(1);

    probe.dispatchEvent(new Event("scroll"));
    await vi.advanceTimersByTimeAsync(40);
    expect(more).toHaveBeenCalledTimes(1);
    expect(container.querySelector(".has-more")?.textContent).toBe("false");
  });

  it("距底超过 threshold 时不请求", async () => {
    vi.useFakeTimers();
    const more = vi.fn(async () => true);
    const { container } = render(ScrollProbe, { props: { mode: "load", more } });
    const probe = container.querySelector(".probe-panel") as HTMLElement;

    // happy-dom 里 getBoundingClientRect 全为 0, 直接改实现返回值以制造"远离底部"
    probe.getBoundingClientRect = () => new DOMRect(0, 10000, 0, 0);
    probe.dispatchEvent(new Event("scroll"));
    await vi.advanceTimersByTimeAsync(40);

    expect(more).not.toHaveBeenCalled();
  });
});

describe("useLoadMore", () => {
  it("从独立文件导出, 且挂在元素上可卸载", () => {
    const handle = {
      page: 0,
      hasMore: true,
      loading: false,
      load: async () => {},
      reset: () => {},
      wants: () => false,
    };
    const attach = useLoadMore(handle);
    const cleanup = attach(document.createElement("div"));

    expect(typeof cleanup).toBe("function");
    expect(() => cleanup?.()).not.toThrow();
  });
});
