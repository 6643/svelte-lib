import { describe, expect, it } from "vite-plus/test";
import { getChinaTimestamp } from "./getChinaTimestamp.ts";

describe("getChinaTimestamp", () => {
  it("返回 YY-MM-DD HH:mm:ss", () => {
    expect(getChinaTimestamp()).toMatch(/^\d{2}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });
});
