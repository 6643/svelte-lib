import { describe, expect, it } from "bun:test";
import { createBootstrapSource, createImportPath } from "../bootstrap";

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
      const source = createBootstrapSource("./App.svelte", "app");
      expect(source).toContain('import App from "./App.svelte"');
      expect(source).toContain('document.getElementById("app")');
      expect(source).toContain('mount(App, {');
    });

    it("should use custom mount id", () => {
      const source = createBootstrapSource("./App.svelte", "root");
      expect(source).toContain('document.getElementById("root")');
    });

    it("should use default values when not provided", () => {
      const source = createBootstrapSource();
      expect(source).toContain('./src/App.svelte');
      expect(source).toContain('"app"');
    });
  });
});
