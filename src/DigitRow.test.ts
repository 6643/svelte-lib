import { render } from "@testing-library/svelte";
import { describe, expect, it } from "vite-plus/test";
import DigitRow from "./DigitRow.svelte";

const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

const currents = (container: HTMLElement): string[] =>
  Array.from(container.querySelectorAll(".digit-wheel .current")).map(
    (node) => node.textContent?.trim() ?? "",
  );

describe("DigitRow", () => {
  it("按 digits 逐位渲染 DigitWheel", () => {
    const { container } = render(DigitRow, { props: { values: DIGITS, digits: [1, 2, 3] } });

    expect(currents(container)).toEqual(["1", "2", "3"]);
  });

  it("separators 里列的索引在对应位前面插冒号", () => {
    const { container } = render(DigitRow, {
      props: { values: DIGITS, digits: [1, 2, 3, 4], separators: [2] },
    });

    const row = container.querySelector(".digit-row") as HTMLElement;
    // 冒号出现在第 3 位 (索引 2) 之前, 只看元素节点
    const nodes = Array.from(row.children).map((node) => node.className.split(" ")[0]);
    expect(nodes).toEqual([
      "digit-wheel",
      "digit-wheel",
      "separator",
      "digit-wheel",
      "digit-wheel",
    ]);
    expect(row.querySelector(".separator")?.textContent).toBe(":");
  });

  it("digits 为空时不渲染任何位", () => {
    const { container } = render(DigitRow, { props: { values: DIGITS, digits: [] } });

    expect(container.querySelectorAll(".digit-wheel")).toHaveLength(0);
  });

  it("direction 透传给每一位", () => {
    const { container } = render(DigitRow, {
      props: { values: DIGITS, digits: [1, 2], direction: -1 },
    });

    expect(container.querySelectorAll(".digit-wheel")).toHaveLength(2);
  });
});
