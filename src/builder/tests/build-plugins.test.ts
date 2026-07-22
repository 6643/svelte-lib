import { expect, test } from "bun:test";
import * as buildInternals from "../build-internals";
import { createProductionEsmEnvPlugin, createSvelteRuntimeAliasPlugin } from "../build-internals";
import { createSvelteBunPlugin } from "../svelte-plugin";

test("createProductionEsmEnvPlugin returns a BunPlugin with correct name", () => {
    const plugin = createProductionEsmEnvPlugin();
    expect(plugin.name).toBe("production-esm-env-plugin");
    expect(plugin.target).toBe("browser");
    expect(typeof plugin.setup).toBe("function");
});

test("createSvelteRuntimeAliasPlugin returns a BunPlugin with correct name", () => {
    const plugin = createSvelteRuntimeAliasPlugin("/tmp/test-root");
    expect(plugin.name).toBe("svelte-runtime-alias-plugin");
    expect(plugin.target).toBe("browser");
    expect(typeof plugin.setup).toBe("function");
});

test("createSvelteBunPlugin returns a BunPlugin with correct name", () => {
    const cssByPath = new Map<string, string>();
    const plugin = createSvelteBunPlugin({ cssByPath, mode: "build" });
    expect(plugin.name).toBe("svelte-bun-plugin");
    expect(plugin.target).toBe("browser");
    expect(typeof plugin.setup).toBe("function");
});

test("build internals no longer expose a duplicate Svelte compiler plugin", () => {
    expect("createSveltePlugin" in buildInternals).toBe(false);
});
