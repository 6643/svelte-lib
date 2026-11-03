import { render, fireEvent } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vite-plus/test";
import SortListBox from "./SortListBox.svelte";
import CityPicker from "./CityPicker.svelte";
import { initCities } from "./cities.svelte.ts";
import ListBoxHost from "../test/fixtures/ListBoxHost.svelte";
import LoadMoreHost from "../test/fixtures/LoadMoreHost.svelte";
import SortHost from "../test/fixtures/SortHost.svelte";

describe("ListBox", () => {
  it("只渲染窗口内的行, 不渲染全部 items", () => {
    const { container } = render(ListBoxHost, {});

    const rows = container.querySelectorAll("[data-index]");
    // 缺省可见 8 行, 上下各留 2 行缓冲 -> 14 行
    expect(rows).toHaveLength(14);
    expect(rows[0]?.getAttribute("data-index")).toBe("0");
    expect(container.textContent).toContain("row-0");
  });

  it("filter 生效后再窗口化", () => {
    const items = Array.from({ length: 40 }, (_, i) => i);
    const { container } = render(ListBoxHost, {
      props: { items, filter: (item: unknown) => Number(item) % 2 === 0 },
    });

    const rows = Array.from(container.querySelectorAll("[data-index]"));
    expect(rows).toHaveLength(14);
    expect(container.textContent).toContain("0#0");
    expect(container.textContent).not.toContain("1#1");
  });

  it("index 变化后窗口滚到目标行", async () => {
    const { rerender, container } = render(ListBoxHost, { props: { index: 0 } });
    expect(container.querySelector('[data-index="0"]')).not.toBeNull();

    await rerender({ index: 30 });
    const indexes = Array.from(container.querySelectorAll("[data-index]")).map((node) =>
      Number(node.getAttribute("data-index")),
    );
    expect(indexes).toContain(30);
    expect(indexes).not.toContain(0);
  });
});

describe("SortListBox", () => {
  it("渲染每行与拖拽手柄", () => {
    const items = ["a", "b", "c"];
    const { container } = render(SortListBox, { props: { items } });

    expect(container.querySelectorAll(".list-item")).toHaveLength(3);
    expect(container.querySelectorAll(".item-actions svg")).toHaveLength(3);
  });
});

describe("LoadMore", () => {
  it("触底时按页码调用 api, bind:this 可拿到 reset", async () => {
    const api = vi.fn(async () => true);
    const { container } = render(LoadMoreHost, { props: { api } });

    const sentinel = container.querySelector(".load-more") as HTMLElement;
    sentinel.dispatchEvent(new Event("scroll"));
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(api).toHaveBeenCalledTimes(1);
    expect(api).toHaveBeenLastCalledWith(0, undefined);

    await fireEvent.click(container.querySelector(".reset") as HTMLButtonElement);
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(api).toHaveBeenLastCalledWith(0, undefined);
    expect(api).toHaveBeenCalledTimes(2);
  });
});

describe("CityPicker", () => {
  // 行政区划码 < 100000 视为中间层 (省/市), >= 100000 视为末级 (区县)
  const csv = [
    "0,1000,广东",
    "0,2000,浙江",
    "1000,1100,广州",
    "1000,1200,深圳",
    "1100,100101,天河",
    "1100,100102,越秀",
  ].join("\n");

  it("open 时按 url 拉取, 点中间层进入下一级, 点末级触发 onselect 并收起", async () => {
    const fetchMock = vi.fn(async () => new Response(csv));
    vi.stubGlobal("fetch", fetchMock);
    const changed = vi.fn();
    let open = true;

    const { container } = render(CityPicker, {
      props: {
        url: "/cities.csv",
        onselect: changed,
        get open() {
          return open;
        },
        set open(next: boolean) {
          open = next;
        },
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(fetchMock).toHaveBeenCalledWith("/cities.csv");
    expect(container.querySelectorAll("main > .option")).toHaveLength(2);
    expect(container.querySelector("main")?.textContent).toContain("广东");

    await fireEvent.click(container.querySelectorAll("main > .option")[0] as HTMLElement);
    expect(container.querySelector("main")?.textContent).toContain("广州");
    expect(open).toBe(true);

    await fireEvent.click(container.querySelectorAll("main > .option")[0] as HTMLElement);
    expect(open).toBe(true);

    await fireEvent.click(container.querySelectorAll("main > .option")[0] as HTMLElement);
    expect(changed).toHaveBeenLastCalledWith({ code: 100101, names: ["广东", "广州", "天河"] });
    expect(open).toBe(false);

    vi.unstubAllGlobals();
  });

  it("initCities 可单独预加载", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(csv)),
    );
    await initCities("/cities.csv");

    const { container } = render(CityPicker, { props: { open: true, url: "/cities.csv" } });
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(container.querySelectorAll("main > .option").length).toBeGreaterThan(0);
    vi.unstubAllGlobals();
  });
});

describe("SortListBox key 契约", () => {
  // 用 item 文本定位节点, 再比较节点身份: 传 key 后同一 item 复用同一个 DOM 节点
  const nodeOf = (container: HTMLElement, text: string) =>
    Array.from(container.querySelectorAll(".list-item")).find(
      (row) => row.textContent?.trim() === text,
    );

  it("传 key 时重排复用 item 对应的节点", async () => {
    const { container, rerender } = render(SortHost, {
      props: { items: ["a", "b", "c"], useKey: true },
    });
    const before = nodeOf(container, "a");

    await rerender({ items: ["c", "b", "a"], useKey: true });
    const after = nodeOf(container, "a");

    expect(after).toBe(before);
    expect(
      Array.from(container.querySelectorAll(".list-item")).map((row) => row.textContent?.trim()),
    ).toEqual(["c", "b", "a"]);
  });

  it("不传 key 时按下标复用 (缺省行为不变)", async () => {
    const { container, rerender } = render(SortHost, { props: { items: ["a", "b", "c"] } });
    const firstRow = container.querySelector(".list-item");

    await rerender({ items: ["c", "b", "a"] });

    // 下标 0 的节点没变, 但内容换成了 c
    expect(container.querySelector(".list-item")).toBe(firstRow);
    expect(firstRow?.textContent?.trim()).toBe("c");
  });
});
