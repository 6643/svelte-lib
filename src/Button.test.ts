import { render, fireEvent } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vite-plus/test";
import Button from "./Button.svelte";
import { icon_add } from "./svgicons.ts";

const buttonOf = (container: HTMLElement) => container.querySelector("button") as HTMLButtonElement;

describe("Button", () => {
  describe("mode=icon (原 IconButton)", () => {
    it("渲染图标并可点击", async () => {
      const onclick = vi.fn();
      const { container } = render(Button, {
        props: { mode: "icon", icon: icon_add, onclick, ariaLabel: "添加" },
      });

      expect(container.querySelector("button svg")).not.toBeNull();
      expect(buttonOf(container).classList.contains("icon")).toBe(true);
      expect(buttonOf(container).getAttribute("aria-label")).toBe("添加");

      await fireEvent.click(buttonOf(container));
      expect(onclick).toHaveBeenCalledTimes(1);
    });

    it("color 写到 --color", () => {
      const { container } = render(Button, {
        props: { mode: "icon", icon: icon_add, color: "red" },
      });

      expect(buttonOf(container).style.getPropertyValue("--color")).toBe("red");
    });
  });

  describe("mode=text (原 TextButton)", () => {
    it("有 text 时渲染文字, 有 icon 时同时渲染图标", () => {
      const withText = render(Button, { props: { mode: "text", text: "ok" } });
      expect(buttonOf(withText.container).textContent).toContain("ok");
      expect(buttonOf(withText.container).querySelector("svg")).toBeNull();

      const withIcon = render(Button, { props: { mode: "text", text: "ok", icon: icon_add } });
      expect(buttonOf(withIcon.container).querySelector("svg")).not.toBeNull();
    });
  });

  describe("mode=filled (原 FilledButton)", () => {
    it("bgColor / borderRadius 落到 CSS 变量", () => {
      const { container } = render(Button, {
        props: { mode: "filled", bgColor: "#123456", borderRadius: 8, text: "go" },
      });
      const button = buttonOf(container);

      expect(button.classList.contains("filled")).toBe(true);
      expect(button.style.getPropertyValue("--bg")).toBe("#123456");
      expect(button.style.getPropertyValue("--radius")).toBe("8px");
    });

    it("text 在没有 children 时渲染", () => {
      const { container } = render(Button, { props: { mode: "filled", text: "fallback" } });
      expect(buttonOf(container).textContent).toContain("fallback");
    });
  });

  describe("mode=outlined (原 OutlinedButton)", () => {
    it("渲染 outlined 类且支持 width/height", () => {
      const { container } = render(Button, {
        props: { mode: "outlined", text: "ghost", width: 120, height: "44px" },
      });
      const button = buttonOf(container);

      expect(button.classList.contains("outlined")).toBe(true);
      expect(button.style.getPropertyValue("--width")).toBe("120px");
      expect(button.style.getPropertyValue("--height")).toBe("44px");
    });
  });

  describe("共用行为 (原 ButtonBase)", () => {
    it("onclick 返回 Promise 期间禁用, resolve 后恢复", async () => {
      let resolveClick: () => void = () => {};
      const onclick = vi.fn(
        () =>
          new Promise<void>((resolve) => {
            resolveClick = resolve;
          }),
      );
      const { container } = render(Button, { props: { mode: "icon", icon: icon_add, onclick } });
      const button = buttonOf(container);

      await fireEvent.click(button);
      expect(button.disabled).toBe(true);

      resolveClick();
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(button.disabled).toBe(false);
      expect(onclick).toHaveBeenCalledTimes(1);
    });

    it("disabled 时不触发 onclick", async () => {
      const onclick = vi.fn();
      const { container } = render(Button, {
        props: { mode: "icon", icon: icon_add, onclick, disabled: true },
      });
      const button = buttonOf(container);

      expect(button.disabled).toBe(true);
      await fireEvent.click(button);
      expect(onclick).not.toHaveBeenCalled();
    });

    it("四种 mode 只带自己的类名", () => {
      for (const mode of ["icon", "text", "filled", "outlined"] as const) {
        const { container } = render(Button, { props: { mode, text: mode } });
        const classes = Array.from(buttonOf(container).classList).filter(
          (name) => !name.startsWith("svelte-"),
        );
        expect(classes).toEqual([mode]);
      }
    });
  });
});
