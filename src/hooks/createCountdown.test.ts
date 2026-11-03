import { describe, expect, it, vi } from "vite-plus/test";
import { render } from "@testing-library/svelte";
import { tick } from "svelte";
import CountdownProbe from "../../test/fixtures/CountdownProbe.svelte";
import { createCountdown } from "./createCountdown.svelte.ts";

const remaining = (el: HTMLElement): string | undefined =>
  el.querySelector(".remaining")?.textContent ?? undefined;

describe("createCountdown", () => {
  it("挂载后每秒减一, 到 0 时恰好回调一次", async () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    const { container } = render(CountdownProbe, { props: { initial: 2, onDone } });

    expect(remaining(container)).toBe("2");

    await vi.advanceTimersByTimeAsync(1000);
    await tick();
    expect(remaining(container)).toBe("1");
    expect(onDone).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);
    await tick();
    expect(remaining(container)).toBe("0");
    expect(onDone).toHaveBeenCalledTimes(1);

    // 再走两拍也不会重复回调
    await vi.advanceTimersByTimeAsync(2000);
    await tick();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("卸载后停表", async () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    const { container, unmount } = render(CountdownProbe, { props: { initial: 5, onDone } });

    await vi.advanceTimersByTimeAsync(1000);
    await tick();
    expect(remaining(container)).toBe("4");

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("自定义间隔生效", async () => {
    vi.useFakeTimers();
    const { container } = render(CountdownProbe, { props: { initial: 5, interval: 100 } });

    await vi.advanceTimersByTimeAsync(200);
    await tick();
    expect(remaining(container)).toBe("3");
  });

  it("tick 是纯数据推进, 不依赖时钟", async () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    const { container } = render(CountdownProbe, { props: { initial: 0, onDone } });
    const tickButton = container.querySelector(".tick") as HTMLButtonElement;

    tickButton.click();
    await tick();
    expect(onDone).toHaveBeenCalledTimes(1);

    // 已结算, 再推也不重复
    tickButton.click();
    await tick();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("在组件外创建会抛 effect_orphan", () => {
    expect(() => createCountdown({ initial: 3 })).toThrow(/effect_orphan/);
  });
});
