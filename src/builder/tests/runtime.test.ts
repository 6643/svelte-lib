import { describe, expect, it } from "bun:test";
import { createRuntimeModuleSource } from "../build-internals";

describe("runtime", () => {
  it("should generate runtime source with default mount id", () => {
    const source = createRuntimeModuleSource("app");
    expect(source).toContain('"app"');
    expect(source).toContain("getMountTarget");
  });

  // --- 新增 ---
  it("should generate runtime source with custom mount id", () => {
    const source = createRuntimeModuleSource("root");
    expect(source).toContain('"root"');
  });

  it("should trim whitespace from mount id", () => {
    const source = createRuntimeModuleSource("  app  ");
    expect(source).toContain('"app"');
  });

  it("should throw for invalid mount id containing spaces", () => {
    expect(() => createRuntimeModuleSource("app root")).toThrow();
  });

  it("should throw for mount id starting with #", () => {
    expect(() => createRuntimeModuleSource("#app")).toThrow();
  });
});
