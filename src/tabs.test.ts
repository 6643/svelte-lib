import { render, fireEvent } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import TabHost from "../test/fixtures/TabHost.svelte";
import Tab from "./Tab.svelte";
import { delPos, getPos } from "./hooks/useKeepScroll.ts";
import type { TabItem, TabMode } from "./tabTypes.ts";

// 滚动/索引状态是模块级的, 每个用例前清掉路径下的记录, 避免串台
beforeEach(() => {
  delPos(location.pathname);
});

// 指示条与面板入场都是 Tween 补间: 动画期间读到的变量是中间值,
// 断言前把假表推进到收敛 (512ms) 之后
afterEach(() => {
  vi.useRealTimers();
});

const settle = async () => {
  await vi.advanceTimersByTimeAsync(600);
};

const items: TabItem[] = [{ name: "one" }, { name: "two" }, { name: "three" }];

const activePanel = (container: HTMLElement) =>
  container.querySelector("main")?.textContent?.trim();

const navButtons = (container: HTMLElement) =>
  Array.from(
    container.querySelectorAll<HTMLButtonElement>(".tab-nav > button, .nav-list > button"),
  );

const MODES: TabMode[] = ["bottom", "top", "left", "menu", "nav"];

describe("Tab 契约", () => {
  it.each(MODES)("mode=%s 只渲染自己的根类与 data-mode", (mode) => {
    const panel = () => {};
    const { container } = render(Tab, {
      props: { mode, items, panel: (() => panel) as never },
    });
    const root = container.firstElementChild as HTMLElement;

    expect(root.className).toContain(`${mode}-tab`);
    // 除自己的根类外不应再带别的形态类
    const modeClasses = root.className.split(/\s+/).filter((name) => name.endsWith("-tab"));
    expect(modeClasses).toEqual([`${mode}-tab`]);
    expect(root.dataset.mode).toBe(mode);
  });

  it("导航项带 role=tab 与 aria-selected", () => {
    const { container } = render(TabHost, { props: { kind: "top", items } });
    const buttons = navButtons(container);

    expect(buttons.map((button) => button.getAttribute("role"))).toEqual(["tab", "tab", "tab"]);
    expect(buttons.map((button) => button.getAttribute("aria-selected"))).toEqual([
      "true",
      "false",
      "false",
    ]);
  });

  it("缺省 key 各 mode 不同, 同一页面多组 tab 不互相覆盖", async () => {
    const { container } = render(TabHost, { props: { kind: "top", items } });
    await fireEvent.click(navButtons(container)[2] as HTMLButtonElement);

    expect(getPos(location.pathname, "top.tab")).toBe(2);
    expect(getPos(location.pathname, "bottom.tab")).toBe(0);
  });

  it("切换后重建组件仍停在上次索引", async () => {
    const first = render(TabHost, { props: { kind: "left", items } });
    await fireEvent.click(navButtons(first.container)[2] as HTMLButtonElement);
    expect(activePanel(first.container)).toContain("panel-2");
    first.unmount();

    const second = render(TabHost, { props: { kind: "left", items } });
    expect(activePanel(second.container)).toContain("panel-2");
    expect(navButtons(second.container)[2]?.classList.contains("active")).toBe(true);
  });
});

describe("Tab mode=bottom", () => {
  it("点第二个导航项后切换到对应面板", async () => {
    const changed = vi.fn();
    const { container } = render(TabHost, {
      props: { kind: "bottom", items, onchange: changed },
    });

    expect(activePanel(container)).toContain("panel-0");
    const buttons = navButtons(container);
    expect(buttons).toHaveLength(3);

    await fireEvent.click(buttons[1] as HTMLButtonElement);
    expect(activePanel(container)).toContain("panel-1");
    expect(changed).toHaveBeenLastCalledWith(1);
    expect(buttons[1]?.classList.contains("active")).toBe(true);
  });

  it("导航条写 --len / --index / --spin (补间到位后)", async () => {
    vi.useFakeTimers();
    const { container } = render(TabHost, { props: { kind: "bottom", items } });
    const nav = container.querySelector(".tab-nav") as HTMLElement;

    expect(nav.style.getPropertyValue("--len")).toBe("3");
    expect(nav.style.getPropertyValue("--index")).toBe("0");
    expect(nav.style.getPropertyValue("--spin")).toBe("0");

    await fireEvent.click(navButtons(container)[1] as HTMLButtonElement);
    // 补间进行中是 0..1 之间的值, 不是立刻跳到 1
    await vi.advanceTimersByTimeAsync(120);
    const midway = Number(nav.style.getPropertyValue("--index"));
    expect(midway).toBeGreaterThan(0);
    expect(midway).toBeLessThan(1);

    await settle();
    expect(nav.style.getPropertyValue("--index")).toBe("1");
    // 向右切换 +360
    expect(nav.style.getPropertyValue("--spin")).toBe("360");

    await fireEvent.click(navButtons(container)[0] as HTMLButtonElement);
    await settle();
    // 向左切换 -360, 回到 0
    expect(nav.style.getPropertyValue("--spin")).toBe("0");
  });

  it("点当前项不触发 onchange", async () => {
    const changed = vi.fn();
    const { container } = render(TabHost, {
      props: { kind: "bottom", items, onchange: changed },
    });

    await fireEvent.click(navButtons(container)[0] as HTMLButtonElement);
    expect(changed).not.toHaveBeenCalled();
  });
});

describe("Tab mode=top", () => {
  it("点第二项切换面板并更新指示器索引", async () => {
    // 假表必须在补间开始前装好: 真实时钟下排的帧任务不会在假表里推进
    vi.useFakeTimers();
    const { container } = render(TabHost, { props: { kind: "top", items } });
    const nav = container.querySelector(".tab-nav") as HTMLElement;

    expect(nav.style.getPropertyValue("--count")).toBe("3");
    await fireEvent.click(navButtons(container)[1] as HTMLButtonElement);
    expect(activePanel(container)).toContain("panel-1");
    await settle();
    expect(nav.style.getPropertyValue("--index")).toBe("1");
  });
});

describe("Tab mode=left", () => {
  it("点导航项写 --top 并切换面板", async () => {
    vi.useFakeTimers();
    const { container } = render(TabHost, { props: { kind: "left", items } });
    const nav = container.querySelector(".tab-nav") as HTMLElement;

    await fireEvent.click(navButtons(container)[2] as HTMLButtonElement);
    expect(activePanel(container)).toContain("panel-2");
    await settle();
    // 每项 68px (源实现的 ITEM_HEIGHT)
    expect(nav.style.getPropertyValue("--top")).toBe(String(68 * 2));
  });

  it("面板动画方向随索引增减", async () => {
    const { container } = render(TabHost, { props: { kind: "left", items } });

    await fireEvent.click(navButtons(container)[2] as HTMLButtonElement);
    expect(container.querySelector("main")?.dataset.direction).toBe("up");

    await fireEvent.click(navButtons(container)[0] as HTMLButtonElement);
    expect(container.querySelector("main")?.dataset.direction).toBe("down");
  });
});

describe("Tab mode=menu", () => {
  it("指示条跟随当前项, 面板随之切换", async () => {
    const { container } = render(TabHost, { props: { kind: "menu", items } });
    const root = container.querySelector(".menu-tab") as HTMLElement;

    await fireEvent.click(navButtons(container)[1] as HTMLButtonElement);
    expect(activePanel(container)).toContain("panel-1");
    // happy-dom 下 offsetLeft/offsetWidth 为 0, 断言变量已写入即可
    expect(root.style.getPropertyValue("--left")).toBe("0");
    expect(root.style.getPropertyValue("--width")).toBe("0");
  });

  it("右侧带菜单按钮", () => {
    const { container } = render(TabHost, { props: { kind: "menu", items } });

    expect(container.querySelector('.menu-tab nav > button[aria-label="Menu"]')).not.toBeNull();
  });
});

describe("Tab mode=nav", () => {
  it("渲染全部面板并写指示器变量", async () => {
    vi.useFakeTimers();
    const changed = vi.fn();
    const { container } = render(TabHost, {
      props: { kind: "nav", items, onchange: changed },
    });
    const nav = container.querySelector(".tab-nav") as HTMLElement;
    const main = container.querySelector("main") as HTMLElement;
    const panels = Array.from(main.children) as HTMLElement[];

    expect(panels).toHaveLength(3);

    // happy-dom 不做布局, 手工给出几何: 容器高 200, 每个面板 200 高且首尾相接
    main.getBoundingClientRect = () => new DOMRect(0, 0, 200, 200);
    panels.forEach((panel, index) => {
      panel.getBoundingClientRect = () => new DOMRect(0, index * 200 - main.scrollTop, 200, 200);
    });

    await fireEvent.click(navButtons(container)[1] as HTMLButtonElement);
    await settle();

    expect(changed).toHaveBeenLastCalledWith(1);
    expect(nav.style.getPropertyValue("--height")).toBe("48");
    expect(nav.style.getPropertyValue("--top")).toBe("52");
  });

  it("整块记忆滚动位置 (不按 tab 分 key)", async () => {
    const { container } = render(TabHost, { props: { kind: "nav", items } });
    const main = container.querySelector("main") as HTMLElement;

    main.scrollTop = 42;
    main.dispatchEvent(new Event("scroll"));
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(getPos(location.pathname, "nav.tab")).toBe(42);
  });
});
