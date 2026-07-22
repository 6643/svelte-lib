import { afterEach, expect, test } from "bun:test";
import { mkdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createMountTargetPlugin, createSvelteBunPlugin, MOUNT_TARGET_MODULE } from "../svelte-plugin";
import { createSvelteRuntimeAliasPlugin } from "../build-internals";

const tempDirs: string[] = [];

const createTempRoot = (name: string): string =>
    join(process.cwd(), ".tmp", `svelte-builder-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`);

afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((rootDir) => rm(rootDir, { recursive: true, force: true })));
});

test("Svelte Bun plugin compiles components and rune modules in build mode", async () => {
    const rootDir = createTempRoot("svelte-plugin-build");
    tempDirs.push(rootDir);
    await mkdir(rootDir, { recursive: true });

    const cssByPath = new Map<string, string>();
    const result = await Bun.build({
        entrypoints: [
            join(process.cwd(), "tests", "fixtures", "builder-plugin-app", "main.ts"),
            join(process.cwd(), "tests", "fixtures", "builder-plugin-app", "state.svelte.js"),
        ],
        outdir: rootDir,
        plugins: [
            createSvelteRuntimeAliasPlugin(process.cwd()),
            createSvelteBunPlugin({ mode: "build", cssByPath }),
        ],
        target: "browser",
    });

    expect(result.success).toBe(true);
    expect(cssByPath.size).toBe(1);

    const output = await Promise.all(result.outputs.map((asset) => asset.text()));
    const bundledOutput = output.join("\n");
    expect(bundledOutput).not.toContain("<h1>");
    expect(bundledOutput).not.toContain("export const state = $state");
    expect(bundledOutput).toContain('var state2 = proxy({ value: "hello" });');
    expect(bundledOutput).toContain('proxy({ value: "from-js" })');
});

test("production build delegates Svelte compilation to the shared Bun plugin", async () => {
    const source = await readFile(join(process.cwd(), "src", "builder", "build.ts"), "utf8");

    expect(source).toContain('from "./svelte-plugin"');
    expect(source).toContain("createSvelteBunPlugin");
    expect(source).not.toContain('from "svelte/compiler"');
    expect(source).not.toContain("const compileSvelteModule");
});

test("mount target plugin injects the configured runtime module", async () => {
    const rootDir = join(tmpdir(), `svelte-builder-mount-target-plugin-${Date.now()}-${Math.random().toString(16).slice(2)}`);
    tempDirs.push(rootDir);
    await mkdir(rootDir, { recursive: true });
    const outDir = join(rootDir, "out");
    await mkdir(outDir, { recursive: true });
    const entryPath = join(rootDir, "main.ts");
    await Bun.write(entryPath, `import { getMountTarget, mountId } from ${JSON.stringify(MOUNT_TARGET_MODULE)};\nexport { getMountTarget, mountId };\n`);

    const result = await Bun.build({
        entrypoints: [entryPath],
        outdir: outDir,
        plugins: [createMountTargetPlugin("plugin-root")],
        target: "browser",
    });

    expect(result.success).toBe(true);
    const output = await Promise.all(result.outputs.map((asset) => asset.text())).then((assets) => assets.join("\n"));
    expect(output).toContain('mountId = "plugin-root"');
    expect(output).toContain("getMountTarget");
});

test("dev module delegates Svelte compilation to the shared Bun plugin", async () => {
    const source = await readFile(join(process.cwd(), "src", "builder", "dev.ts"), "utf8");

    expect(source).toContain('from "./svelte-plugin"');
    expect(source).toContain("createSvelteBunPlugin");
    expect(source).not.toContain('from "svelte/compiler"');
    expect(source).not.toContain("const compileSvelteForDev");
    expect(source).not.toContain("const compileSvelteRunesForDev");
    expect(source).not.toContain("const rewriteBareImportsForDev");
    expect(source).not.toContain("const createCssInjection");
    expect(source).toContain('external: ["svelte", "svelte/*", "esm-env"]');
});

test("Bun fullstack server applies the Svelte plugin to an HTML route", async () => {
    const fixtureRoot = join(process.cwd(), "tests", "fixtures", "builder-plugin-app");
    const scriptPath = join(
        fixtureRoot,
        "fullstack-server.ts",
    );
    const child = Bun.spawn([process.execPath, scriptPath], {
        cwd: fixtureRoot,
        stderr: "pipe",
        stdout: "pipe",
    });
    const [stdout, stderr] = await Promise.all([
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
        child.exited,
    ]).then(([output, error]) => [output, error] as const);

    expect(child.exitCode).toBe(0);
    if (child.exitCode !== 0) {
        throw new Error(stderr || stdout);
    }

    const result = JSON.parse(stdout.trim().split("\n").at(-1) ?? "{}");
    expect(result.pageStatus).toBe(200);
    expect(result.scriptStatus).toBe(200);
    expect(result.cssStatus).toBe(null);
    expect(result.development).toBe(true);
    expect(result.hasCompiledComponent).toBe(true);
    expect(result.hasCssInjection).toBe(true);
});
