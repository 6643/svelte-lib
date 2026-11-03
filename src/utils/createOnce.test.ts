import { describe, expect, it, vi } from "vite-plus/test";
import { createOnce } from "./createOnce.ts";

describe("createOnce", () => {
  it("只执行一次并复用首次结果", () => {
    const fn = vi.fn((value: number) => value * 2);
    const once = createOnce(fn);

    expect(once(2)).toBe(4);
    expect(once(9)).toBe(4);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
