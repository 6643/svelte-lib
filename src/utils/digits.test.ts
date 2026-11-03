import { describe, expect, it } from "vite-plus/test";
import { DIGITS } from "./digits.ts";

describe("DIGITS", () => {
  it("是 0..9 的十个数字", () => {
    expect(DIGITS).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("是可变数组, 可直接作为 DigitWheel 的 values", () => {
    expect(Array.isArray(DIGITS)).toBe(true);
    expect(DIGITS).toHaveLength(10);
  });
});
