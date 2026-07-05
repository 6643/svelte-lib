import { afterEach, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { BuildArtifacts } from "../build";
import * as buildModule from "../build";
import * as devModule from "../dev";

const tempDirs: string[] = [];

const createTempRoot = (name: string): string =>
    join(process.cwd(), ".tmp", `svelte-builder-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`);

afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((rootDir) => rm(rootDir, { recursive: true, force: true })));
});

test("build module exposes the core build entry", async () => {
    const buildEntrypoint = (buildModule as Record<string, unknown>).build;
    expect(typeof buildEntrypoint).toBe("function");
    if (typeof buildEntrypoint !== "function") {
        return;
    }

    const result = await buildEntrypoint({
        rootDir: "/tmp/project",
    });

    expect(result.ok).toBe(false);
});

test("dev module exposes the core serve entry", async () => {
    const serveEntrypoint = (devModule as Record<string, unknown>).serve;
    expect(typeof serveEntrypoint).toBe("function");
    if (typeof serveEntrypoint !== "function") {
        return;
    }

    const result = await serveEntrypoint({
        cwd: "/tmp/project",
    });

    expect(result.ok).toBe(false);
});

test("dev server rejects appComponent files directly under the project root", async () => {
    const rootDir = createTempRoot("dev-root-app");
    tempDirs.push(rootDir);

    await mkdir(rootDir, { recursive: true });
    await writeFile(join(rootDir, "App.svelte"), "<p>root app</p>\n", "utf8");
    await writeFile(
        join(rootDir, "builder.ts"),
        'export default { appComponent: "App.svelte", port: 0 };\n',
        "utf8",
    );

    const result = await devModule.serve({ cwd: rootDir });

    expect(result.ok).toBe(false);
    if (result.ok) {
        await result.value.stop();
        throw new Error("Expected root-level appComponent to be rejected");
    }
    expect(result.error.includes("inside src/ or another top-level source directory")).toBe(true);
});
