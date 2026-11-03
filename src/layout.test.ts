import { render } from "@testing-library/svelte";
import { describe, expect, it } from "vite-plus/test";
import { createRawSnippet } from "svelte";
import Card from "./Card.svelte";
import Block from "./Box.svelte";
import FlexBox from "./FlexBox.svelte";
import GridBox from "./GridBox.svelte";
import CenterBox from "./CenterBox.svelte";
import AvatarImage from "./AvatarImage.svelte";
import FlexChildren from "../test/fixtures/FlexChildren.svelte";
import GridChildren from "../test/fixtures/GridChildren.svelte";
import StackChildren from "../test/fixtures/StackChildren.svelte";

const text = (value: string) => createRawSnippet(() => ({ render: () => `<span>${value}</span>` }));

describe("Card", () => {
  it("渲染子节点并透传 class", () => {
    const { container } = render(Card, {
      props: { className: "extra", children: text("card") },
    });

    const card = container.querySelector(".card");
    expect(card).not.toBeNull();
    expect(card?.classList.contains("extra")).toBe(true);
    expect(card?.textContent).toContain("card");
  });
});

describe("Block", () => {
  it("给 headerTitle 时渲染标题, 不给时不渲染 header", () => {
    const withTitle = render(Block, {
      props: { headerTitle: "Title", children: text("body") },
    });
    expect(withTitle.container.querySelector(".header")?.textContent).toContain("Title");

    const withoutTitle = render(Block, { props: { children: text("body") } });
    expect(withoutTitle.container.querySelector(".header")).toBeNull();
  });

  it("只给 headerActions 时也渲染 header", () => {
    const { container } = render(Block, {
      props: {
        headerActions: createRawSnippet(() => ({ render: () => "<span>ac</span>" })),
        children: text("body"),
      },
    });
    expect(container.querySelector(".header")?.textContent).toContain("ac");
  });

  it("给 footerLeft 时渲染 footer", () => {
    const { container } = render(Block, {
      props: { footerLeft: "tip", children: text("body") },
    });

    expect(container.querySelector(".footer")?.textContent).toContain("tip");
  });

  it("没有 footer 内容时不渲染 footer", () => {
    const { container } = render(Block, { props: { children: text("body") } });

    expect(container.querySelector(".footer")).toBeNull();
  });
});

describe("CenterBox", () => {
  it("把 w/h 写成 --w/--h", () => {
    const { container } = render(CenterBox, {
      props: { w: 50, h: 25, children: text("center") },
    });

    const box = container.querySelector(".center-box") as HTMLElement;
    expect(box.style.getPropertyValue("--w")).toBe("50");
    expect(box.style.getPropertyValue("--h")).toBe("25");
  });
});

describe("AvatarImage", () => {
  it("按 color 映射边框色", () => {
    const blue = render(AvatarImage, { props: { src: "a.png", color: "blue" } });
    const blueImg = blue.container.querySelector("img") as HTMLImageElement;
    expect(blueImg.style.getPropertyValue("--color")).toBe("#00AEEC");
    expect(blueImg.style.getPropertyValue("--size")).toBe("");

    const gray = render(AvatarImage, { props: { src: "a.png", color: "gray" } });
    const grayImg = gray.container.querySelector("img") as HTMLImageElement;
    expect(grayImg.style.getPropertyValue("--color")).toBe("");
  });

  it("size 写到 --size", () => {
    const { container } = render(AvatarImage, { props: { src: "a.png", size: 64 } });
    const img = container.querySelector("img") as HTMLImageElement;

    expect(img.style.getPropertyValue("--size")).toBe("64");
    expect(img.getAttribute("src")).toBe("a.png");
  });
});

describe("FlexBox", () => {
  it("方向和间距写到 CSS 变量", () => {
    const { container } = render(FlexBox, {
      props: { dir: "column", gap: 8, children: text("flex") },
    });

    const box = container.querySelector(".flex-box") as HTMLElement;
    expect(box.style.getPropertyValue("--dir")).toBe("column");
    expect(box.style.getPropertyValue("--gap")).toBe("8");
  });

  it("逐子元素的 flex-grow 写成根元素变量, 子元素不再有内联样式", () => {
    const { container } = render(FlexChildren, { props: { fg: [1, 2] } });

    const box = container.querySelector(".flex-box") as HTMLElement;
    expect(box.style.getPropertyValue("--child-1-grow")).toBe("1");
    expect(box.style.getPropertyValue("--child-2-grow")).toBe("2");
    expect(box.hasAttribute("data-child-grow")).toBe(true);

    const nodes = Array.from(container.querySelectorAll(".flex-box > span")) as HTMLElement[];
    expect(nodes.map((node) => node.getAttribute("style"))).toEqual([null, null]);
  });

  it("未传 fg 时不产生 grow 变量与守卫属性", () => {
    const { container } = render(FlexChildren, {});
    const box = container.querySelector(".flex-box") as HTMLElement;

    expect(box.style.getPropertyValue("--child-1-grow")).toBe("");
    expect(box.hasAttribute("data-child-grow")).toBe(false);
  });

  it("超出子元素上限的项被忽略", () => {
    const fg = Array.from({ length: 20 }, (_, index) => index + 1);
    const { container } = render(FlexChildren, { props: { fg } });
    const box = container.querySelector(".flex-box") as HTMLElement;

    // CHILD_LIMIT = 12: 只写前 12 个
    expect(box.style.getPropertyValue("--child-12-grow")).toBe("12");
    expect(box.style.getPropertyValue("--child-13-grow")).toBe("");
  });
});

describe("GridBox", () => {
  it("areas 字符串转换成 grid-template-areas 形式", () => {
    const { container } = render(GridBox, {
      props: { columns: "1fr 1fr", areas: "a,b;c,d", children: text("grid") },
    });

    const box = container.querySelector(".grid-box") as HTMLElement;
    expect(box.style.getPropertyValue("--columns")).toBe("1fr 1fr");
    expect(box.style.getPropertyValue("--areas")).toBe('"_a _b" "_c _d"');
  });

  it("子元素的 grid-area 由 CSS 按序号给出, 不再写内联样式", () => {
    const { container } = render(GridChildren, {});

    const nodes = Array.from(container.querySelectorAll(".grid-box > span")) as HTMLElement[];
    expect(nodes.map((node) => node.getAttribute("style"))).toEqual([null, null]);
  });
});

describe("StackBox", () => {
  it("pos 写成根元素的逐子元素偏移变量", () => {
    const { container } = render(StackChildren, {
      props: { pos: [{ x: 10, y: -5 }] },
    });

    const box = container.querySelector(".stack-box") as HTMLElement;
    expect(box.style.getPropertyValue("--child-1-left")).toBe("10");
    expect(box.style.getPropertyValue("--child-1-bottom")).toBe("5");
    expect(box.style.getPropertyValue("--child-1-top")).toBe("");
    expect(box.hasAttribute("data-child-pos")).toBe(true);

    const node = container.querySelector(".stack-box > span") as HTMLElement;
    expect(node.getAttribute("style")).toBeNull();
  });
});
