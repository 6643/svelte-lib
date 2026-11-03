import { cleanup, render } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vite-plus/test";
import App from "./App.svelte";

afterEach(cleanup);

describe("demo", () => {
  it("全部分组都能挂载", () => {
    const { container, unmount } = render(App);

    const headings = Array.from(container.querySelectorAll("h2")).map((el) => el.textContent);
    expect(headings).toEqual([
      "Buttons",
      "Icons",
      "Layout",
      "Input",
      "Display",
      "Tabs",
      "Interaction",
      "Functional",
      "Route",
    ]);

    expect(() => unmount()).not.toThrow();
  });

  // 下面几条守住"演示必须正确接线"这一契约: 组件本身 1:1 翻译对了,
  // 但漏传受控回调/尺寸宿主都会让页面看起来像 bug (真实浏览器验证时踩过).
  it("字符串类字段默认可编辑 (只读需显式 readonly)", () => {
    const { container } = render(App);

    const inputs = Array.from(
      container.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
        ".field input, .field textarea",
      ),
    );
    const byLabel = (label: string) =>
      inputs.find((input) => input.closest(".field")?.querySelector("span")?.textContent === label);

    for (const label of ["文本", "多行", "密码", "邮箱", "电话"]) {
      const input = byLabel(label);
      expect(input, label).toBeDefined();
      expect(input?.readOnly, label).toBe(false);
    }
  });

  it("Layout 的 StackBox 逐子定位, ListBox/NavTab 有定尺宿主", () => {
    const { container } = render(App);

    const stack = container.querySelector(".stack-box") as HTMLElement | null;
    expect(stack?.children).toHaveLength(2);
    // 第二个子元素的偏移写在根元素变量上 (由 CSS 的 :nth-child 规则消费)
    expect(stack?.style.getPropertyValue("--child-2-left")).toBe("20");
    expect(stack?.style.getPropertyValue("--child-2-top")).toBe("20");
    expect((stack?.children[1] as HTMLElement | undefined)?.getAttribute("style")).toBeNull();

    expect(container.querySelector(".list-host .list-box")).not.toBeNull();
    expect(container.querySelector(".nav-host .nav-tab")).not.toBeNull();
    expect(container.querySelector(".center-host .center-box")).not.toBeNull();
  });

  // 附件在挂载时自行补首页会形成 effect 死循环 (加载 -> 状态变化 -> 重挂附件 -> 再加载),
  // 一旦有人改回"自动补首页", 这条测试会让 svelte 直接抛 effect_update_depth_exceeded.
  it("LoadMore 挂载时不会自行补首页", () => {
    expect(() => render(App)).not.toThrow();
  });
});
