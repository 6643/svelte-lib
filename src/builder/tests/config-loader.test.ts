import { afterEach, expect, test } from "bun:test";
import { readdir, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { loadSvelteConfig } from "../config";

const tempDirs: string[] = [];

const createTempProject = async (builderSource: string): Promise<string> => {
    const rootDir = join("/tmp", `svelte-builder-config-loader-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    tempDirs.push(rootDir);

    await mkdir(join(rootDir, "src"), { recursive: true });
    await writeFile(join(rootDir, "builder.ts"), builderSource, "utf8");

    return rootDir;
};

afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((rootDir) => rm(rootDir, { recursive: true, force: true })));
});

test("loadSvelteConfig does not leave transient builder loader files in project root", async () => {
    const rootDir = await createTempProject(`
        export default {
            appTitle: "Transient Loader"
        };
    `);

    const before = await readdir(rootDir);
    expect(before.some((entry) => entry.startsWith(".builder.ts."))).toBe(false);

    const result = await loadSvelteConfig(rootDir);

    expect(result.ok).toBe(true);
    if (!result.ok) {
        throw new Error(result.error);
    }

    const after = await readdir(rootDir);
    expect(after.some((entry) => entry.startsWith(".builder.ts."))).toBe(false);
});
