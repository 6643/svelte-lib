import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const demoRoot = resolve(import.meta.dir, "..", "demo");

const readDemoFile = (path: string): Promise<string> => readFile(resolve(demoRoot, path), "utf8");

test("demo exports builder configuration directly", async () => {
    const source = await readDemoFile("builder.ts");

    expect(source).toContain("export default {");
    expect(source).not.toContain("defineSvelteConfig");
});

test("demo leaves the mount root to the builder shell", async () => {
    const source = await readDemoFile("src/App.svelte");

    expect(source).not.toContain('id="app"');
    expect(source).toContain("svelte-lib");
    expect(source).not.toContain("svelte-builder");
});

test("demo declares the current consumer workflow", async () => {
    const packageJson = JSON.parse(await readDemoFile("package.json")) as {
        dependencies?: Record<string, unknown>;
        devDependencies?: Record<string, unknown>;
        scripts?: Record<string, unknown>;
    };

    expect(packageJson.dependencies?.svelte).toBe("latest");
    expect(packageJson.devDependencies?.["svelte-check"]).toBe("latest");
    expect(packageJson.devDependencies?.typescript).toBe("latest");
    expect(packageJson.scripts?.build).toBe("bun svelte-build");
    expect(packageJson.scripts?.dev).toBe("bun svelte-dev");
    expect(packageJson.scripts?.check).toBe("bun x svelte-check --tsconfig ./tsconfig.json");
});
