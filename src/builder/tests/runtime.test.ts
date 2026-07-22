import { describe, expect, it } from "bun:test";
import { JSDOM } from "jsdom";

import { createRuntimeModuleSource } from "../build-internals";

let runtimeModuleVersion = 0;

const loadRuntimeModule = async (mountId: string): Promise<{
  getMountTarget: (scope?: Document) => Element;
  mountId: string;
}> => {
  runtimeModuleVersion += 1;
  const source = createRuntimeModuleSource(mountId);
  return import(
    `data:text/javascript;charset=utf-8,${encodeURIComponent(`${source}\n//# sourceURL=svelte-lib-runtime-${runtimeModuleVersion}.js`)}`
  ) as Promise<{
    getMountTarget: (scope?: Document) => Element;
    mountId: string;
  }>;
};

describe("runtime", () => {
  it("should generate runtime source with default mount id", () => {
    const source = createRuntimeModuleSource("app");
    expect(source).toContain('"app"');
    expect(source).toContain("getMountTarget");
    expect(source).toContain('scope.createElement("div")');
    expect(source).toContain("body.append(target)");
    expect(source).not.toContain("Missing mount id");
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

  it("reuses an existing configured target", async () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");
    const existing = dom.window.document.createElement("section");
    existing.id = "root";
    dom.window.document.body.append(existing);

    try {
      const runtime = await loadRuntimeModule("root");
      expect(runtime.getMountTarget(dom.window.document)).toBe(existing);
      expect(dom.window.document.querySelectorAll("#root").length).toBe(1);
    } finally {
      dom.window.close();
    }
  });

  it("creates and reuses a fallback target when the configured ID is absent", async () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>");

    try {
      const runtime = await loadRuntimeModule("plugin-root");
      const first = runtime.getMountTarget(dom.window.document);
      const second = runtime.getMountTarget(dom.window.document);

      expect(first.tagName).toBe("DIV");
      expect(first.id).toBe("plugin-root");
      expect(first.parentElement).toBe(dom.window.document.body);
      expect(second).toBe(first);
      expect(dom.window.document.querySelectorAll("#plugin-root").length).toBe(1);
    } finally {
      dom.window.close();
    }
  });

  it("reports a missing document body while creating a fallback", async () => {
    const runtime = await loadRuntimeModule("root");
    const scope = {
      getElementById: () => null,
      createElement: () => ({ id: "" }),
      body: null,
    } as unknown as Document;

    expect(() => runtime.getMountTarget(scope)).toThrow(
      "Cannot create mount target before document.body exists",
    );
  });
});
