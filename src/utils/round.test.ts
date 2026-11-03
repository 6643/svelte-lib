import { describe, expect, it } from "vite-plus/test";
import { roundCss } from "./round.ts";

describe("roundCss", () => {
  it("保留三位小数", () => {
    expect(roundCss(1 / 3)).toBe(0.333);
    expect(roundCss(2 / 3)).toBe(0.667);
  });

  it("整数与整数串不受影响", () => {
    expect(roundCss(3)).toBe(3);
    expect(roundCss(0)).toBe(0);
  });

  it("负数同样收敛 (spin 反向转)", () => {
    expect(roundCss(-1 / 3)).toBe(-0.333);
  });
});
