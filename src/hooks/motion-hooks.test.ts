import { render, fireEvent } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vite-plus/test";
import { tick } from "svelte";
import TweenProbe from "../../test/fixtures/TweenProbe.svelte";

const current = (container: HTMLElement): number =>
  Number(container.querySelector(".current")?.textContent);

describe("createTween", () => {
  it("目标变化后逐帧逼近, 收敛到目标值", async () => {
    vi.useFakeTimers();
    const { container, component } = render(TweenProbe, { props: { initial: 0 } });
    expect(current(container)).toBe(0);

    component.setTarget(100);
    await tick();
    await vi.advanceTimersByTimeAsync(120);
    const midway = current(container);
    expect(midway).toBeGreaterThan(0);
    expect(midway).toBeLessThan(100);

    await vi.advanceTimersByTimeAsync(1000);
    expect(current(container)).toBe(100);
    vi.useRealTimers();
  });

  it("补间中途改目标, 从当前帧继续而不是跳回起点", async () => {
    vi.useFakeTimers();
    const { container, component } = render(TweenProbe, { props: { initial: 0 } });

    component.setTarget(100);
    await tick();
    await vi.advanceTimersByTimeAsync(240);
    const before = current(container);
    expect(before).toBeGreaterThan(0);

    component.setTarget(0);
    await tick();
    await vi.advanceTimersByTimeAsync(1000);
    // 收敛回 0, 且中途没有回到 100
    expect(current(container)).toBe(0);
    vi.useRealTimers();
  });

  it("duration=0 时目标立即生效", async () => {
    const { container, component } = render(TweenProbe, {
      props: { initial: 0, duration: 0 },
    });

    await fireEvent.click(container);
    component.setTarget(42);
    await tick();
    expect(current(container)).toBe(42);
  });
});

describe("createTween 目标回退", () => {
  it("补间中途把目标改小, 不会先跑到旧目标", async () => {
    vi.useFakeTimers();
    const { container, component } = render(TweenProbe, { props: { initial: 0 } });

    component.setTarget(100);
    await tick();
    await vi.advanceTimersByTimeAsync(120);
    expect(current(container)).toBeLessThan(100);

    component.setTarget(50);
    await tick();
    // 旧补间被就地中止, 当前值不会闪到 100
    expect(current(container)).toBeLessThan(100);

    await vi.advanceTimersByTimeAsync(1000);
    expect(current(container)).toBe(50);
    vi.useRealTimers();
  });
});
