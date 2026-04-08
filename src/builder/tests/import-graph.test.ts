import { expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { realpathSync } from "node:fs";
import { join } from "node:path";

import { validateLocalSourceImportGraph } from "../build";

test("validateLocalSourceImportGraph rejects app-local package imports that escape the app source tree", async () => {
    const rootDir = `/tmp/svelte-builder-import-graph-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    await rm(rootDir, { recursive: true, force: true });
    await mkdir(join(rootDir, "src"), { recursive: true });
    await writeFile(
        join(rootDir, "package.json"),
        JSON.stringify({
            imports: {
                "#config": "./config.ts",
            },
            name: "app",
        }),
        "utf8",
    );
    await writeFile(join(rootDir, "src", "App.ts"), 'import "#config";\n', "utf8");
    await writeFile(join(rootDir, "config.ts"), "export const value = 1;\n", "utf8");

    try {
        const result = await validateLocalSourceImportGraph(join(rootDir, "src", "App.ts"), [realpathSync(join(rootDir, "src"))]);

        expect(result.ok).toBe(false);
        if (result.ok) {
            throw new Error("Expected package import outside the app source tree to be rejected");
        }

        expect(result.error.includes("#config")).toBe(true);
        expect(result.error.includes("app source tree")).toBe(true);
    } finally {
        await rm(rootDir, { recursive: true, force: true });
    }
});

test("validateLocalSourceImportGraph rejects app-local package imports that target external dependencies", async () => {
    const rootDir = `/tmp/svelte-builder-import-graph-external-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    await rm(rootDir, { recursive: true, force: true });
    await mkdir(join(rootDir, "src"), { recursive: true });
    await writeFile(
        join(rootDir, "package.json"),
        JSON.stringify({
            imports: {
                "#runtime": "svelte",
            },
            name: "app",
        }),
        "utf8",
    );
    await writeFile(join(rootDir, "src", "App.ts"), 'import "#runtime";\n', "utf8");

    try {
        const result = await validateLocalSourceImportGraph(join(rootDir, "src", "App.ts"), [realpathSync(join(rootDir, "src"))]);

        expect(result.ok).toBe(false);
        if (result.ok) {
            throw new Error("Expected app-local package imports to be unsupported");
        }

        expect(result.error.includes("#runtime")).toBe(true);
        expect(result.error.includes("package imports are not supported")).toBe(true);
    } finally {
        await rm(rootDir, { recursive: true, force: true });
    }
});
