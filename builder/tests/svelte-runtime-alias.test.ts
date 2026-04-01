import { expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { resolveSvelteBrowserImportPath, validateSvelteBrowserImportAliases } from "../build";

test("resolveSvelteBrowserImportPath resolves runtime imports from the nearest svelte package root", async () => {
    const rootDir = `/tmp/svelte-runtime-alias-local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    await mkdir(join(rootDir, "node_modules", "svelte", "src", "store"), { recursive: true });
    await mkdir(join(rootDir, "node_modules", "svelte", "src", "legacy"), { recursive: true });
    await mkdir(join(rootDir, "node_modules", "svelte", "src", "internal", "client"), { recursive: true });
    await writeFile(join(rootDir, "node_modules", "svelte", "package.json"), JSON.stringify({ name: "svelte" }), "utf8");

    expect(resolveSvelteBrowserImportPath(rootDir, "svelte")).toBe(join(rootDir, "node_modules", "svelte", "src", "index-client.js"));
    expect(resolveSvelteBrowserImportPath(rootDir, "svelte/store")).toBe(join(rootDir, "node_modules", "svelte", "src", "store", "index-client.js"));
    expect(resolveSvelteBrowserImportPath(rootDir, "svelte/legacy")).toBe(join(rootDir, "node_modules", "svelte", "src", "legacy", "legacy-client.js"));
    expect(resolveSvelteBrowserImportPath(rootDir, "svelte/internal/client")).toBe(
        join(rootDir, "node_modules", "svelte", "src", "internal", "client", "index.js"),
    );
    expect(resolveSvelteBrowserImportPath(rootDir, "not-svelte")).toBeNull();

    await rm(rootDir, { force: true, recursive: true });
});

test("validateSvelteBrowserImportAliases reports missing aliased runtime files", async () => {
    const rootDir = `/tmp/svelte-runtime-alias-missing-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    await mkdir(join(rootDir, "node_modules", "svelte", "src"), { recursive: true });
    await writeFile(join(rootDir, "node_modules", "svelte", "package.json"), JSON.stringify({ name: "svelte" }), "utf8");
    await writeFile(join(rootDir, "node_modules", "svelte", "src", "index-client.js"), "export {};", "utf8");

    const result = await validateSvelteBrowserImportAliases(rootDir);

    expect(result.ok).toBe(false);
    if (result.ok) {
        throw new Error("Expected alias validation to fail when internal runtime files are missing");
    }

    expect(result.error.includes("svelte/store")).toBe(true);
    await rm(rootDir, { force: true, recursive: true });
});

test("resolveSvelteBrowserImportPath supports hoisted parent node_modules layouts", async () => {
    const workspaceRoot = `/tmp/svelte-runtime-alias-hoisted-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const appRoot = join(workspaceRoot, "packages", "app");
    const svelteRoot = join(workspaceRoot, "node_modules", "svelte");

    await mkdir(join(appRoot, "src"), { recursive: true });
    await mkdir(join(svelteRoot, "src", "store"), { recursive: true });
    await mkdir(join(svelteRoot, "src", "legacy"), { recursive: true });
    await mkdir(join(svelteRoot, "src", "internal", "client"), { recursive: true });

    await Promise.all([
        writeFile(join(svelteRoot, "package.json"), JSON.stringify({ name: "svelte" }), "utf8"),
        writeFile(join(svelteRoot, "src", "index-client.js"), "export {};", "utf8"),
        writeFile(join(svelteRoot, "src", "store", "index-client.js"), "export {};", "utf8"),
        writeFile(join(svelteRoot, "src", "legacy", "legacy-client.js"), "export {};", "utf8"),
        writeFile(join(svelteRoot, "src", "internal", "index.js"), "export {};", "utf8"),
        writeFile(join(svelteRoot, "src", "internal", "client", "index.js"), "export {};", "utf8"),
        writeFile(join(svelteRoot, "src", "internal", "disclose-version.js"), "export {};", "utf8"),
    ]);

    expect(resolveSvelteBrowserImportPath(appRoot, "svelte")).toBe(join(svelteRoot, "src", "index-client.js"));

    const validation = await validateSvelteBrowserImportAliases(appRoot);
    expect(validation.ok).toBe(true);
    if (!validation.ok) {
        throw new Error(validation.error);
    }

    await rm(workspaceRoot, { force: true, recursive: true });
});
