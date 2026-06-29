import { expect, test } from "bun:test";
import { createProductionEsmEnvPlugin, createSvelteRuntimeAliasPlugin, createSveltePlugin } from "../build";

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

test("createSveltePlugin returns a BunPlugin with correct name", () => {
    const cssByPath = new Map<string, string>();
    const plugin = createSveltePlugin(cssByPath);
    expect(plugin.name).toBe("svelte-prod-plugin");
    expect(plugin.target).toBe("browser");
    expect(typeof plugin.setup).toBe("function");
});
