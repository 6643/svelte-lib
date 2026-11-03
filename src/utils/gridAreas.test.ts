import { describe, expect, it } from "vite-plus/test";
import { toGridAreaName, toGridAreas } from "./gridAreas.ts";

describe("toGridAreas", () => {
  it("2x2 区域表转成 grid-template-areas 形式", () => {
    expect(toGridAreas("a,b;c,d")).toBe('"_a _b" "_c _d"');
  });

  it("空格被忽略, 空段与半截段丢弃", () => {
    expect(toGridAreas("a, b ; c,d;; e")).toBe('"_a _b" "_c _d"');
  });

  it("单行也合法", () => {
    expect(toGridAreas("a,b")).toBe('"_a _b"');
  });
});

describe("toGridAreaName", () => {
  it("纯数字加下划线前缀", () => {
    expect(toGridAreaName("1")).toBe("_1");
    expect(toGridAreaName("12")).toBe("_12");
  });

  it("非数字原样返回", () => {
    expect(toGridAreaName("head")).toBe("head");
    expect(toGridAreaName("1a")).toBe("1a");
  });
});
