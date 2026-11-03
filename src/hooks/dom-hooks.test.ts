import { afterEach, describe, expect, it, vi } from "vite-plus/test";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
import { tick } from "svelte";
import { render } from "@testing-library/svelte";
import HookProbe from "../../test/fixtures/HookProbe.svelte";

describe("DOM hooks", () => {
  it("useClickOutside 在外部按下时回调", async () => {
    const onOutside = vi.fn();
    const { container } = render(HookProbe, { props: { onOutside } });

    container
      .querySelector(".target")
      ?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(onOutside).not.toHaveBeenCalled();

    document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(onOutside).toHaveBeenCalledTimes(1);
  });

  it("useKeyPress 命中指定按键", async () => {
    const onKey = vi.fn();
    render(HookProbe, { props: { onKey } });

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
    expect(onKey).not.toHaveBeenCalled();

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
    expect(onKey).toHaveBeenCalledTimes(1);
  });

  it("useTap 在阈值内触发, 位移过大不触发", async () => {
    const onTap = vi.fn();
    const { container } = render(HookProbe, { props: { onTap } });
    const target = container.querySelector(".target") as HTMLElement;
    target.setPointerCapture = () => {};
    target.releasePointerCapture = () => {};

    // PointerEventInit 不接收 timeStamp, 构造后改写只读属性以模拟时序
    const withTime = (event: PointerEvent, timeStamp: number) => {
      Object.defineProperty(event, "timeStamp", { value: timeStamp });
      return event;
    };
    const down = (x: number, y: number, timeStamp: number) =>
      withTime(
        new PointerEvent("pointerdown", {
          button: 0,
          pointerId: 1,
          clientX: x,
          clientY: y,
          bubbles: true,
        }),
        timeStamp,
      );
    const up = (x: number, y: number, timeStamp: number) =>
      withTime(
        new PointerEvent("pointerup", {
          button: 0,
          pointerId: 1,
          clientX: x,
          clientY: y,
          bubbles: true,
        }),
        timeStamp,
      );

    target.dispatchEvent(down(0, 0, 0));
    target.dispatchEvent(up(2, 2, 100));
    expect(onTap).toHaveBeenCalledTimes(1);

    target.dispatchEvent(down(0, 0, 0));
    target.dispatchEvent(up(100, 100, 100));
    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it("useLongPress 按住超过 delay 才触发", async () => {
    vi.useFakeTimers();
    const onLongPress = vi.fn();
    const { container } = render(HookProbe, { props: { onLongPress } });
    const target = container.querySelector(".target") as HTMLElement;
    target.setPointerCapture = () => {};
    target.releasePointerCapture = () => {};

    target.dispatchEvent(
      new PointerEvent("pointerdown", {
        button: 0,
        pointerId: 1,
        clientX: 0,
        clientY: 0,
        bubbles: true,
      }),
    );
    await vi.advanceTimersByTimeAsync(500);
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it("useMutation 在子节点变化时回调", async () => {
    const onMutate = vi.fn();
    const { container } = render(HookProbe, { props: { onMutate } });
    const target = container.querySelector(".target") as HTMLElement;

    target.appendChild(document.createElement("span"));
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(onMutate).toHaveBeenCalled();
  });

  it("useRefresh 下拉超过阈值后触发 refresh 并回到 Nil", async () => {
    vi.useFakeTimers();
    const onRefresh = vi.fn(async () => {});
    const { container } = render(HookProbe, { props: { onRefresh } });
    const box = container.querySelector(".box") as HTMLElement;
    box.setPointerCapture = () => {};
    box.releasePointerCapture = () => {};
    box.hasPointerCapture = () => false;

    box.dispatchEvent(
      new PointerEvent("pointerdown", { button: 0, pointerId: 1, clientY: 0, bubbles: true }),
    );
    box.dispatchEvent(
      new PointerEvent("pointermove", { button: 0, pointerId: 1, clientY: 300, bubbles: true }),
    );
    // 状态变更在微任务里刷到 DOM
    await tick();
    expect(box.classList.contains("ready")).toBe(true);

    box.dispatchEvent(
      new PointerEvent("pointerup", { button: 0, pointerId: 1, clientY: 300, bubbles: true }),
    );
    await vi.advanceTimersByTimeAsync(0);
    await tick();
    expect(onRefresh).toHaveBeenCalledTimes(1);
    // refresh 立即 resolve, 因此很快进入 Done; 断言已离开 Loading 或已到 Done
    expect(box.classList.contains("loading") || box.classList.contains("done")).toBe(true);

    await vi.advanceTimersByTimeAsync(600);
    await tick();
    // 动画结束后回到 Nil, 只剩宿主类名
    expect(box.classList.contains("done")).toBe(false);
    expect(box.classList.contains("use-refresh-host")).toBe(true);
  });
});
