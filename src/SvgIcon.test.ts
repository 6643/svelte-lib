import { render } from "@testing-library/svelte";
import { describe, expect, it } from "vite-plus/test";
import SvgIcon from "./SvgIcon.svelte";
import { icon_add, icon_home } from "./svgicons.ts";

describe("SvgIcon", () => {
  it("把 svgPaths 渲染成 svg 内的 path", () => {
    const { container } = render(SvgIcon, { props: { svgPaths: icon_home } });

    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.querySelector("path")).not.toBeNull();
    expect(svg?.getAttribute("viewBox")).toBe("0 -960 960 960");
  });

  it("size 缺省 24, 可覆盖", () => {
    const fallback = render(SvgIcon, { props: { svgPaths: icon_add } });
    const svg = fallback.container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("24");
    expect(svg?.getAttribute("height")).toBe("24");

    const sized = render(SvgIcon, { props: { svgPaths: icon_add, size: 40 } });
    const sizedSvg = sized.container.querySelector("svg");
    expect(sizedSvg?.getAttribute("width")).toBe("40");
    expect(sizedSvg?.getAttribute("height")).toBe("40");
  });

  it("color 写到 --color 变量", () => {
    const { container } = render(SvgIcon, { props: { svgPaths: icon_add, color: "red" } });
    const svg = container.querySelector("svg") as SVGElement;

    expect(svg.style.getPropertyValue("--color")).toBe("red");
  });
});
