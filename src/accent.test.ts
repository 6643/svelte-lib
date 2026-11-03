import { render, fireEvent } from "@testing-library/svelte";
import { describe, expect, it, beforeEach } from "vite-plus/test";
import AccentSelector from "./AccentSelector.svelte";
import { accent, resetThemeForTest } from "./theme.svelte.ts";

const trigger = (container: HTMLElement) => container.querySelector("button") as HTMLButtonElement;

describe("AccentSelector", () => {
  beforeEach(() => {
    localStorage.clear();
    resetThemeForTest();
  });

  it("默认收起, 面板不在 DOM 里", () => {
    const { container } = render(AccentSelector);

    expect(container.querySelector(".picker")).toBeNull();
    expect(trigger(container).getAttribute("aria-expanded")).toBe("false");
  });

  it("点触发按钮展开, aria-expanded 同步", async () => {
    const { container } = render(AccentSelector);

    await fireEvent.click(trigger(container));
    expect(container.querySelector(".picker")).not.toBeNull();
    expect(trigger(container).getAttribute("aria-expanded")).toBe("true");

    await fireEvent.click(trigger(container));
    expect(container.querySelector(".picker")).toBeNull();
  });

  it("点色板应用强调色并收起", async () => {
    const { container } = render(AccentSelector);
    await fireEvent.click(trigger(container));

    const swatches = Array.from(container.querySelectorAll(".swatch")) as HTMLButtonElement[];
    expect(swatches).toHaveLength(8);

    const indigo = swatches.find((node) => node.title === "indigo") as HTMLButtonElement;
    await fireEvent.click(indigo);

    expect(accent.value).toBe("#3f51b5");
    expect(container.querySelector(".picker")).toBeNull();
  });

  it("当前强调色带 selected 标记", async () => {
    accent.set("#4caf50");
    const { container } = render(AccentSelector);
    await fireEvent.click(trigger(container));

    const selected = Array.from(container.querySelectorAll(".swatch.selected")).map(
      (node) => (node as HTMLElement).title,
    );
    expect(selected).toEqual(["green"]);
  });

  it("点面板外部收起", async () => {
    const { container } = render(AccentSelector);
    await fireEvent.click(trigger(container));

    // 面板内部按下不收起
    await fireEvent.mouseDown(container.querySelector(".picker") as HTMLElement);
    expect(container.querySelector(".picker")).not.toBeNull();

    await fireEvent.mouseDown(document.body);
    expect(container.querySelector(".picker")).toBeNull();
  });

  it("每个色板都有可访问名称", async () => {
    const { container } = render(AccentSelector);
    await fireEvent.click(trigger(container));

    const labels = Array.from(container.querySelectorAll(".swatch")).map((node) =>
      node.getAttribute("aria-label"),
    );
    expect(labels).toEqual(["teal", "blue", "purple", "pink", "red", "orange", "green", "indigo"]);
  });
});
