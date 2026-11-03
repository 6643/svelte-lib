import { render, fireEvent } from "@testing-library/svelte";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { createRawSnippet, tick } from "svelte";
import Modal from "./Modal.svelte";
import Expand from "./Expand.svelte";
import CarouselHost from "../test/fixtures/CarouselHost.svelte";
import ModalToggle from "../test/fixtures/ModalToggle.svelte";

const text = (value: string) => createRawSnippet(() => ({ render: () => `<span>${value}</span>` }));

// 动效用假表推进; 不还原时钟会把假表泄漏给后续用例 (补间队列由 test/setup.ts 清)
afterEach(() => {
  vi.useRealTimers();
});

describe("Modal", () => {
  it("open=false 时不挂载 dialog", () => {
    const { container } = render(Modal, { props: { mode: "bottom", open: false } });

    expect(container.querySelector("dialog")).toBeNull();
  });

  it("open=true 时 dialog 以 showModal 打开", async () => {
    const { container } = render(Modal, {
      props: { mode: "bottom", open: true, children: text("body") },
    });
    await tick();

    const dialog = container.querySelector("dialog") as HTMLDialogElement;
    expect(dialog).not.toBeNull();
    expect(dialog.open).toBe(true);
    expect(dialog.textContent).toContain("body");
  });

  it("Esc 触发 onClose", async () => {
    const onClose = vi.fn();
    const { container } = render(Modal, { props: { mode: "bottom", open: true, onClose } });
    const dialog = container.querySelector("dialog") as HTMLDialogElement;

    await fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("点遮罩触发 onClose, 点内容不触发", async () => {
    const onClose = vi.fn();
    const { container } = render(Modal, { props: { mode: "bottom", open: true, onClose } });
    const dialog = container.querySelector("dialog") as HTMLDialogElement;
    const overlay = dialog.querySelector(".overlay") as HTMLElement;
    const content = dialog.querySelector(".content") as HTMLElement;

    await fireEvent.click(content);
    expect(onClose).not.toHaveBeenCalled();

    await fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("open 从 true 变 false 后 dialog 关闭并卸载", async () => {
    vi.useFakeTimers();
    const { container } = render(ModalToggle, { props: { initial: true } });
    await tick();
    expect(container.querySelector("dialog")?.open).toBe(true);

    await fireEvent.click(container.querySelector(".toggle") as HTMLButtonElement);
    await tick();
    // 收起动画期间 dialog 仍在 DOM (与源实现一致), 动画结束后卸载
    expect(container.querySelector("dialog")).not.toBeNull();

    await vi.advanceTimersByTimeAsync(400);
    await tick();
    expect(container.querySelector("dialog")).toBeNull();
  });

  it("mode 命中 dialog 类名, 内容区类名按方向映射", async () => {
    // 与源实现一致: top 复用 .center (上下居中), left/right 复用同名内容类,
    // bottom 依赖 .content 的缺省排布 (贴底), 不额外加类
    const cases = [
      ["bottom", undefined],
      ["top", "center"],
      ["left", "left"],
      ["right", "right"],
    ] as const;

    for (const [mode, contentClass] of cases) {
      const { container } = render(Modal, { props: { mode, open: true } });
      await tick();
      const dialog = container.querySelector("dialog") as HTMLDialogElement;
      expect(dialog.classList.contains(mode), mode).toBe(true);

      const content = dialog.querySelector(".content") as HTMLElement;
      const contentClasses = Array.from(content.classList).filter(
        (name) => name !== "content" && !name.startsWith("svelte-"),
      );
      // 每个方向只带自己那一个内容类, 不会互相残留
      expect(contentClasses, mode).toEqual(contentClass ? [contentClass] : []);
      expect(content.dataset.mode).toBe(contentClass ?? "bottom");
    }
  });

  it("width/height 写到 CSS 变量上", async () => {
    const { container } = render(Modal, {
      props: { mode: "left", open: true, width: "240px", height: "60vh" },
    });
    await tick();

    const content = container.querySelector(".content") as HTMLElement;
    expect(content.style.getPropertyValue("--max-width")).toBe("240px");
    expect(content.style.getPropertyValue("--max-height")).toBe("60vh");
  });

  it("未传 width/height 时不写内联变量, 交给 CSS 缺省值", async () => {
    const { container } = render(Modal, { props: { mode: "right", open: true } });
    await tick();

    const content = container.querySelector(".content") as HTMLElement;
    expect(content.getAttribute("style") ?? "").toBe("");
  });
});

describe("Expand", () => {
  it("点标题展开内容, 再点收起", async () => {
    const { container } = render(Expand, { props: { title: "more", children: text("hidden") } });
    expect(container.querySelector(".expand > div")).toBeNull();

    await fireEvent.click(container.querySelector(".expand > .head") as HTMLElement);
    expect(container.querySelector(".expand > div")?.textContent).toContain("hidden");
    expect(container.querySelector(".expand")?.classList.contains("active")).toBe(true);

    await fireEvent.click(container.querySelector(".expand > .head") as HTMLElement);
    expect(container.querySelector(".expand")?.classList.contains("active")).toBe(false);
  });
});

describe("Carousel", () => {
  // 位移由 Tween 补间 (240ms), 断言推进假表后的中间值与终值
  const offset = (container: HTMLElement): number => {
    const transform = (container.querySelector(".inner") as HTMLElement).style.transform;
    return Math.abs(Number(transform.replace(/[^\d.-]/g, "")));
  };

  it("按 index 补间位移, 前后按钮循环切换", async () => {
    vi.useFakeTimers();
    const { container } = render(CarouselHost, {
      props: { imgs: ["a.png", "b.png", "c.png"] },
    });
    const index = () => Number(container.querySelector(".index")?.textContent);

    expect(container.querySelectorAll("img")).toHaveLength(3);
    expect(offset(container)).toBe(0);

    await fireEvent.click(container.querySelector(".next") as HTMLButtonElement);
    expect(index()).toBe(1);
    await tick();
    // 补间进行中是 0 与 100 之间的值, 而不是立刻跳到 100
    await vi.advanceTimersByTimeAsync(120);
    expect(offset(container)).toBeGreaterThan(0);
    expect(offset(container)).toBeLessThan(100);

    await vi.advanceTimersByTimeAsync(400);
    expect(offset(container)).toBe(100);

    await fireEvent.click(container.querySelector(".prev") as HTMLButtonElement);
    await fireEvent.click(container.querySelector(".prev") as HTMLButtonElement);
    expect(index()).toBe(2);
    await tick();
    await vi.advanceTimersByTimeAsync(400);
    expect(offset(container)).toBe(200);
    vi.useRealTimers();
  });
});

describe("Modal close 幂等", () => {
  it("keydown 与 cancel 先后到达时 onClose 只触发一次", async () => {
    const onClose = vi.fn();
    const { container } = render(Modal, { props: { mode: "bottom", open: true, onClose } });
    const dialog = container.querySelector("dialog") as HTMLDialogElement;

    // 真实浏览器: Escape 先 keydown, 随后 dialog 派发 cancel
    await fireEvent.keyDown(dialog, { key: "Escape" });
    await fireEvent(dialog, new Event("cancel", { cancelable: true }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("点遮罩与 Escape 连续触发也只调一次 onClose", async () => {
    const onClose = vi.fn();
    const { container } = render(Modal, { props: { mode: "bottom", open: true, onClose } });
    const dialog = container.querySelector("dialog") as HTMLDialogElement;

    await fireEvent.click(dialog.querySelector(".overlay") as HTMLElement);
    await fireEvent.keyDown(dialog, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
