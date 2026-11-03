import { render, fireEvent } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import Counter from "./Counter.svelte";
import CountDown from "./CountDown.svelte";
import TimeLine from "./TimeLine.svelte";
import ImagePlayer from "./ImagePlayer.svelte";

const digits = (container: HTMLElement): string[] =>
  Array.from(container.querySelectorAll(".digit-wheel .current")).map(
    (node) => node.textContent?.trim() ?? "",
  );

afterEach(() => {
  vi.useRealTimers();
});

describe("Counter", () => {
  it("渲染初始值的数字轮", () => {
    const { container } = render(Counter, { props: { value: 12 } });

    expect(digits(container)).toEqual(["1", "2"]);
  });

  it("点 + 递增, 点 - 递减", async () => {
    vi.useFakeTimers();
    const { container } = render(Counter, { props: { value: 5 } });
    const [decrement, increment] = Array.from(
      container.querySelectorAll("button"),
    ) as HTMLButtonElement[];

    await fireEvent.click(increment);
    // 数字轮是弹簧动画, 收敛后才显示新数字
    await vi.advanceTimersByTimeAsync(1000);
    expect(digits(container)).toEqual(["6"]);

    await fireEvent.click(decrement);
    await vi.advanceTimersByTimeAsync(1000);
    expect(digits(container)).toEqual(["5"]);
  });

  it("触顶 max 不再增加, 触底 min 不再减少", async () => {
    vi.useFakeTimers();
    const { container } = render(Counter, { props: { value: 2, min: 2, max: 3 } });
    const [decrement, increment] = Array.from(
      container.querySelectorAll("button"),
    ) as HTMLButtonElement[];

    await fireEvent.click(decrement);
    await vi.advanceTimersByTimeAsync(1000);
    expect(digits(container)).toEqual(["2"]);

    await fireEvent.click(increment);
    await vi.advanceTimersByTimeAsync(1000);
    expect(digits(container)).toEqual(["3"]);

    await fireEvent.click(increment);
    await vi.advanceTimersByTimeAsync(1000);
    expect(digits(container)).toEqual(["3"]);
  });

  it("负数渲染负号", () => {
    const { container } = render(Counter, { props: { value: -3 } });

    expect(container.querySelector(".counter")?.textContent).toContain("-");
    expect(digits(container)).toEqual(["3"]);
  });
});

describe("CountDown", () => {
  it("value=2 时 onDone 恰好被调用一次", async () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    render(CountDown, { props: { value: 2, onDone } });

    await vi.advanceTimersByTimeAsync(4000);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("卸载后定时器不再触发", async () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    const { unmount } = render(CountDown, { props: { value: 5, onDone } });

    unmount();
    await vi.advanceTimersByTimeAsync(10000);
    expect(onDone).not.toHaveBeenCalled();
  });

  it("小于 1 秒时显示 00:00", () => {
    const { container } = render(CountDown, { props: { value: 0 } });

    expect(digits(container)).toEqual(["0", "0", "0", "0", "0"]);
    expect(container.querySelector(".countdown")?.textContent).toContain(":");
  });
});

describe("TimeLine", () => {
  const events = [
    { time: 1, info: "a" },
    { time: 2, info: "b" },
    { time: 3, info: "c" },
    { time: 4, info: "d" },
  ];

  it("默认只显示 visCount 条, 展开后显示全部", async () => {
    const { container } = render(TimeLine, { props: { title: "log", events } });

    expect(container.querySelectorAll(".item")).toHaveLength(3);
    expect(container.querySelector(".toggle")).not.toBeNull();

    await fireEvent.click(container.querySelector(".toggle button") as HTMLElement);
    expect(container.querySelectorAll(".item")).toHaveLength(4);
  });

  it("条目数量未超过 visCount 时不显示展开按钮", () => {
    const { container } = render(TimeLine, {
      props: { title: "log", events: events.slice(0, 2) },
    });

    expect(container.querySelector(".toggle")).toBeNull();
  });
});

describe("ImagePlayer", () => {
  it("渲染两份图片用于无缝滚动, 尺寸落到 CSS 变量", () => {
    const { container } = render(ImagePlayer, {
      props: { imgs: ["a.png", "b.png"], duration: 16, height: 120 },
    });

    expect(container.querySelectorAll("img")).toHaveLength(4);
    const player = container.querySelector(".image-player") as HTMLElement;
    expect(player.style.getPropertyValue("--duration")).toBe("16");
    expect(player.style.getPropertyValue("--height")).toBe("120");
  });
});
