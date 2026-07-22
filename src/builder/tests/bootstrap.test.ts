import { describe, expect, it } from "bun:test";
import { createBootstrapSource, createImportPath } from "../build-internals";

describe("bootstrap", () => {
  describe("createImportPath", () => {
    it("should create relative import starting with ./", () => {
      expect(createImportPath("/project/src", "/project/src/App.svelte")).toBe("./App.svelte");
    });

    it("should create relative import for nested paths", () => {
      expect(createImportPath("/project/src", "/project/src/components/Button.svelte")).toBe("./components/Button.svelte");
    });

    it("should normalize backslashes to forward slashes", () => {
      const result = createImportPath("/project/src", "/project/src/App.svelte");
      expect(result).toBe("./App.svelte");
      expect(result).not.toContain("\\");
    });
  });

  describe("createBootstrapSource", () => {
    it("should generate valid bootstrap module source", () => {
      const source = createBootstrapSource("./App.svelte", "app", true);
      expect(source).toContain('import App from "./App.svelte"');
      expect(source).toContain('const mountId = "app"');
      expect(source).toContain("const body = scope.body");
      expect(source).toContain('scope.createElement("div")');
      expect(source).toContain("target.id = mountId");
      expect(source).toContain("body.append(target)");
      expect(source).toContain('Cannot create mount target before document.body exists');
      expect(source).not.toContain("Missing mount target");
      expect(source).toContain('mount(App, {');
      expect(source).toContain('import { mount, unmount } from "svelte"');
      expect(source).toContain("import.meta.hot.accept");
    });

    it("does not add native HMR code to the default bootstrap", () => {
      const source = createBootstrapSource("./App.svelte", "app");

      expect(source).toContain('import { mount } from "svelte"');
      expect(source).not.toContain("unmount");
      expect(source).not.toContain("import.meta.hot");
    });

    it("should use custom mount id", () => {
      const source = createBootstrapSource("./App.svelte", "root");
      expect(source).toContain('const mountId = "root"');
    });

    it("should use default values when not provided", () => {
      const source = createBootstrapSource();
      expect(source).toContain('./src/App.svelte');
      expect(source).toContain('"app"');
    });
  });
});
