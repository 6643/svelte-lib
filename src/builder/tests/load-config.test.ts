import { afterEach, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { loadSvelteConfig } from "../build";

const tempDirs: string[] = [];

const createTempProject = async (builderSource: string): Promise<string> => {
    const rootDir = join("/tmp", `svelte-builder-config-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    tempDirs.push(rootDir);

    await mkdir(join(rootDir, "src"), { recursive: true });
    await writeFile(join(rootDir, "builder.ts"), builderSource, "utf8");

    return rootDir;
};

const createTempProjectWithoutBuilder = async (): Promise<string> => {
    const rootDir = join("/tmp", `svelte-builder-config-no-builder-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    tempDirs.push(rootDir);

    await mkdir(join(rootDir, "src"), { recursive: true });
    return rootDir;
};

afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((rootDir) => rm(rootDir, { recursive: true, force: true })));
});

test("loadSvelteConfig loads a default-exported builder.ts config", async () => {
    const rootDir = await createTempProject(`
        export default {
            appComponent: "src/App.svelte",
            appTitle: "Builder TS",
            outDir: ".build",
            stripSvelteDiagnostics: true
        };
    `);

    const result = await loadSvelteConfig(rootDir);

    expect(result.ok).toBe(true);
    if (!result.ok) {
        throw new Error(result.error);
    }

    expect(result.value.appTitle).toBe("Builder TS");
    expect(result.value.appComponent).toBe("src/App.svelte");
    expect(result.value.rootDir).toBe(rootDir);
});

test("loadSvelteConfig rejects legacy JSON config files when builder.ts is absent", async () => {
    const rootDir = await createTempProjectWithoutBuilder();
    await writeFile(
        join(rootDir, "svelte-builder.config.json"),
        JSON.stringify({ appTitle: "legacy-json" }),
        "utf8",
    );

    const result = await loadSvelteConfig(rootDir);

    expect(result.ok).toBe(false);
    if (result.ok) {
        throw new Error("Expected legacy JSON config to be rejected");
    }

    expect(result.error.includes("svelte-builder.config.json")).toBe(true);
    expect(result.error.includes("builder.ts")).toBe(true);
});

test("loadSvelteConfig does not leak builder.ts side effects into the current process", async () => {
    delete (globalThis as typeof globalThis & { __builderSideEffectForTest?: number }).__builderSideEffectForTest;

    const rootDir = await createTempProject(`
        globalThis.__builderSideEffectForTest = (globalThis.__builderSideEffectForTest ?? 0) + 1;

        export default {
            appTitle: "Isolated Builder"
        };
    `);

    const result = await loadSvelteConfig(rootDir);

    expect(result.ok).toBe(true);
    if (!result.ok) {
        throw new Error(result.error);
    }

    expect((globalThis as typeof globalThis & { __builderSideEffectForTest?: number }).__builderSideEffectForTest).toBeUndefined();
});

test("loadSvelteConfig tolerates builder.ts stdout noise from top-level code", async () => {
    const rootDir = await createTempProject(`
        console.log("builder-noise");

        export default {
            appTitle: "Noisy Builder"
        };
    `);

    const result = await loadSvelteConfig(rootDir);

    expect(result.ok).toBe(true);
    if (!result.ok) {
        throw new Error(result.error);
    }

    expect(result.value.appTitle).toBe("Noisy Builder");
});

test("loadSvelteConfig accepts mountId values that are valid DOM ids but not CSS identifier tokens", async () => {
    const rootDir = await createTempProject(`
        export default {
            mountId: "app:root"
        };
    `);

    const result = await loadSvelteConfig(rootDir);

    expect(result.ok).toBe(true);
    if (!result.ok) {
        throw new Error(result.error);
    }

    expect(result.value.mountId).toBe("app:root");
});
