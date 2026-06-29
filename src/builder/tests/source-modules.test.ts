import { describe, expect, it } from "bun:test";
import {
  formatSupportedLocalSourceModuleExtensions,
  isSupportedJavaScriptSourceModule,
  isSupportedLocalSourceModule,
  isSupportedSvelteSourceModule,
  isSupportedTypeScriptSourceModule,
} from "../build";

describe("source-modules", () => {
  describe("isSupportedSvelteSourceModule", () => {
    it("should return true for .svelte files", () => {
      expect(isSupportedSvelteSourceModule("App.svelte")).toBe(true);
      expect(isSupportedSvelteSourceModule("src/App.svelte")).toBe(true);
    });

    it("should return false for non-svelte files", () => {
      expect(isSupportedSvelteSourceModule("App.ts")).toBe(false);
      expect(isSupportedSvelteSourceModule("App.js")).toBe(false);
    });
  });

  describe("isSupportedTypeScriptSourceModule", () => {
    it("should return true for .ts files", () => {
      expect(isSupportedTypeScriptSourceModule("App.ts")).toBe(true);
      expect(isSupportedTypeScriptSourceModule("src/utils.ts")).toBe(true);
    });

    it("should return false for .d.ts files", () => {
      expect(isSupportedTypeScriptSourceModule("types.d.ts")).toBe(false);
    });

    it("should return false for non-ts files", () => {
      expect(isSupportedTypeScriptSourceModule("App.js")).toBe(false);
      expect(isSupportedTypeScriptSourceModule("App.svelte")).toBe(false);
    });
  });

  describe("isSupportedJavaScriptSourceModule", () => {
    it("should return true for .js files", () => {
      expect(isSupportedJavaScriptSourceModule("App.js")).toBe(true);
    });

    it("should return true for .mjs files", () => {
      expect(isSupportedJavaScriptSourceModule("App.mjs")).toBe(true);
    });

    it("should return false for .ts files", () => {
      expect(isSupportedJavaScriptSourceModule("App.ts")).toBe(false);
    });
  });

  describe("isSupportedLocalSourceModule", () => {
    it("should return true for supported extensions", () => {
      expect(isSupportedLocalSourceModule("App.svelte")).toBe(true);
      expect(isSupportedLocalSourceModule("App.ts")).toBe(true);
      expect(isSupportedLocalSourceModule("App.js")).toBe(true);
      expect(isSupportedLocalSourceModule("App.mjs")).toBe(true);
    });

    it("should return false for .d.ts files", () => {
      expect(isSupportedLocalSourceModule("types.d.ts")).toBe(false);
    });

    it("should return false for unsupported extensions", () => {
      expect(isSupportedLocalSourceModule("App.css")).toBe(false);
      expect(isSupportedLocalSourceModule("App.json")).toBe(false);
    });
  });

  describe("formatSupportedLocalSourceModuleExtensions", () => {
    it("should return comma-separated extensions", () => {
      const result = formatSupportedLocalSourceModuleExtensions();
      expect(result).toContain(".svelte");
      expect(result).toContain(".ts");
      expect(result).toContain(".js");
      expect(result).toContain(".mjs");
    });
  });
});
