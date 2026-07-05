import { afterEach, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { build } from "../build";

const tempDirs: string[] = [];

const createTempRoot = (name: string): string =>
    join(process.cwd(), ".tmp", `svelte-builder-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`);

afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((rootDir) => rm(rootDir, { recursive: true, force: true })));
});

test("buildSvelte reports emitted chunks for lazy route components", async () => {
    const rootDir = createTempRoot("build-lazy-chunks");
    tempDirs.push(rootDir);

    await mkdir(join(rootDir, "src", "routes"), { recursive: true });
    await writeFile(
        join(rootDir, "src", "App.svelte"),
        `<script lang="ts">
    import { Route } from "svelte-lib/route";
    import Home from "./routes/Home.svelte";
</script>

<Route path="/" component={Home} />
<Route path="/lazy" component={() => import("./routes/Lazy.svelte")} />
`,
        "utf8",
    );
    await writeFile(join(rootDir, "src", "routes", "Home.svelte"), "<p>home</p>\n", "utf8");
    await writeFile(join(rootDir, "src", "routes", "Lazy.svelte"), "<p>lazy</p>\n", "utf8");

    const result = await build({
        appComponent: "src/App.svelte",
        outDir: "dist",
        rootDir,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
        throw new Error(result.error);
    }

    expect((result.value.jsChunkFiles?.length ?? 0) > 0).toBe(true);
    expect(result.value.jsFile.endsWith(".js")).toBe(true);
    expect(result.value.jsFile.length > 8).toBe(true);
    for (const file of result.value.jsChunkFiles ?? []) {
        expect(file.endsWith(".js")).toBe(true);
        expect(existsSync(join(result.value.outDir, file))).toBe(true);
    }
    expect(result.value.cssFile.length === 0 || result.value.cssFile.endsWith(".css")).toBe(true);
});

test("buildSvelte copies multiple static asset directories by directory name", async () => {
    const rootDir = createTempRoot("build-assets-dirs");
    tempDirs.push(rootDir);

    await mkdir(join(rootDir, "src"), { recursive: true });
    await mkdir(join(rootDir, "assets"), { recursive: true });
    await mkdir(join(rootDir, "public"), { recursive: true });
    await writeFile(join(rootDir, "src", "App.svelte"), "<p>app</p>\n", "utf8");
    await writeFile(join(rootDir, "assets", "logo.svg"), "<svg></svg>\n", "utf8");
    await writeFile(join(rootDir, "public", "robots.txt"), "User-agent: *\n", "utf8");

    const result = await build({
        appComponent: "src/App.svelte",
        assetsDirs: ["assets", "public"],
        outDir: "dist",
        rootDir,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
        throw new Error(result.error);
    }

    expect(existsSync(join(result.value.outDir, "assets", "logo.svg"))).toBe(true);
    expect(existsSync(join(result.value.outDir, "public", "robots.txt"))).toBe(true);
});

test("buildSvelte removes stale output files before writing the next build", async () => {
    const rootDir = createTempRoot("build-clean-output");
    tempDirs.push(rootDir);

    await mkdir(join(rootDir, "src"), { recursive: true });
    await mkdir(join(rootDir, "assets"), { recursive: true });
    await writeFile(join(rootDir, "src", "App.svelte"), "<p>app</p>\n", "utf8");
    await writeFile(join(rootDir, "assets", "stale.txt"), "stale\n", "utf8");

    const first = await build({
        appComponent: "src/App.svelte",
        assetsDirs: ["assets"],
        outDir: "dist",
        rootDir,
    });

    expect(first.ok).toBe(true);
    if (!first.ok) {
        throw new Error(first.error);
    }
    expect(existsSync(join(first.value.outDir, "assets", "stale.txt"))).toBe(true);

    await rm(join(rootDir, "assets", "stale.txt"));

    const second = await build({
        appComponent: "src/App.svelte",
        assetsDirs: ["assets"],
        outDir: "dist",
        rootDir,
    });

    expect(second.ok).toBe(true);
    if (!second.ok) {
        throw new Error(second.error);
    }
    expect(existsSync(join(second.value.outDir, "assets", "stale.txt"))).toBe(false);
});

test("buildSvelte rejects appComponent files directly under the project root", async () => {
    const rootDir = createTempRoot("build-root-app");
    tempDirs.push(rootDir);

    await mkdir(rootDir, { recursive: true });
    await writeFile(join(rootDir, "App.svelte"), "<p>root app</p>\n", "utf8");

    const result = await build({
        appComponent: "App.svelte",
        outDir: "dist",
        rootDir,
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
        throw new Error("Expected root-level appComponent to be rejected");
    }
    expect(result.error.includes("inside src/ or another top-level source directory")).toBe(true);
});

test("buildSvelte rejects outDir paths whose physical parent escapes the project root", async () => {
    const rootDir = createTempRoot("build-symlink-outdir");
    const externalDir = createTempRoot("build-symlink-outside");
    tempDirs.push(rootDir, externalDir);

    await mkdir(join(rootDir, "src"), { recursive: true });
    await mkdir(externalDir, { recursive: true });
    await writeFile(join(rootDir, "src", "App.svelte"), "<p>app</p>\n", "utf8");
    await symlink(externalDir, join(rootDir, "linked-out"), "dir");

    const result = await build({
        appComponent: "src/App.svelte",
        outDir: "linked-out/dist",
        rootDir,
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
        throw new Error("Expected symlinked outDir parent to be rejected");
    }
    expect(result.error.includes("outDir")).toBe(true);
    expect(existsSync(join(externalDir, "dist", "index.html"))).toBe(false);
});

test("buildSvelte compiles local .svelte.ts rune modules", async () => {
    const rootDir = createTempRoot("build-rune-module");
    tempDirs.push(rootDir);

    await mkdir(join(rootDir, "src"), { recursive: true });
    await writeFile(
        join(rootDir, "src", "state.svelte.ts"),
        [
            "export type CounterState = { value: number };",
            "const initial: CounterState = { value: 1 };",
            "export const counter = $state(initial);",
            "",
        ].join("\n"),
        "utf8",
    );
    await writeFile(
        join(rootDir, "src", "App.svelte"),
        `<script lang="ts">
            import { counter } from "./state.svelte.ts";
        </script>

        <p>{counter.value}</p>
        `,
        "utf8",
    );

    const result = await build({
        appComponent: "src/App.svelte",
        outDir: "dist",
        rootDir,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
        throw new Error(result.error);
    }

    const emittedJavaScript = await Promise.all(
        [result.value.jsFile, ...(result.value.jsChunkFiles ?? [])].map((file) => readFile(join(result.value.outDir, file), "utf8")),
    );
    expect(emittedJavaScript.join("\n")).not.toMatch(/\$state\s*\(/);
});
