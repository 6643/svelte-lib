import { afterEach, expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { BuildArtifacts } from "../build";
import * as buildModule from "../build";
import * as devModule from "../dev";

const tempDirs: string[] = [];

const createTempRoot = (name: string): string =>
    join(process.cwd(), ".tmp", `svelte-builder-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`);

const waitFor = async (predicate: () => Promise<boolean>, timeoutMs = 3000): Promise<void> => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        try {
            if (await predicate()) return;
        } catch {
            // Native runtime restarts briefly close the listening socket.
        }
        await Bun.sleep(50);
    }

    throw new Error(`Timed out after ${timeoutMs}ms`);
};

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

test("dev server compiles local .svelte.ts rune modules", async () => {
    const rootDir = createTempRoot("dev-rune-module");
    tempDirs.push(rootDir);

    await mkdir(join(rootDir, "src"), { recursive: true });
    await writeFile(
        join(rootDir, "builder.ts"),
        'export default { appComponent: "src/App.svelte", port: 0 };\n',
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

    const result = await devModule.serve({ cwd: rootDir });
    expect(result.ok).toBe(true);
    if (!result.ok) {
        throw new Error(result.error);
    }

    try {
        const response = await fetch(`http://localhost:${result.value.port}/src/state.svelte.ts`);
        const source = await response.text();
        const runtimeResponse = await fetch(
            `http://localhost:${result.value.port}/_node_modules/svelte/src/index-client.js`,
        );
        const runtimeSource = await runtimeResponse.text();
        const entryResponse = await fetch(`http://localhost:${result.value.port}/main.ts`);
        const entrySource = await entryResponse.text();

        expect(response.status).toBe(200);
        expect(source).not.toContain("const counter = $state(initial)");
        expect(source).toContain("proxy(initial)");
        expect(runtimeResponse.status).toBe(200);
        expect(runtimeSource).toContain("./internal/client/runtime.js");
        expect(entryResponse.status).toBe(200);
        expect(entrySource).not.toContain('import App from "./src/App.svelte"');
        expect(entrySource).toContain("mount(App");
        expect(entrySource).toContain('scope.createElement("div")');
        expect(entrySource).toContain("body.append(target)");
        expect(entrySource).not.toContain("Missing mount target");
    } finally {
        await result.value.stop();
    }
});

test("dev server recovers after a Svelte compile error", async () => {
    const rootDir = createTempRoot("dev-compile-recovery");
    tempDirs.push(rootDir);

    await mkdir(join(rootDir, "src"), { recursive: true });
    await writeFile(join(rootDir, "builder.ts"), 'export default { appComponent: "src/App.svelte", port: 0 };\n', "utf8");
    const appPath = join(rootDir, "src", "App.svelte");
    const validSource = "<h1>healthy</h1>\n";
    await writeFile(appPath, validSource, "utf8");

    const result = await devModule.serve({ cwd: rootDir });
    expect(result.ok).toBe(true);
    if (!result.ok) {
        throw new Error(result.error);
    }

    try {
        const initialResponse = await fetch(`http://localhost:${result.value.port}/main.ts`);
        expect(initialResponse.status).toBe(200);

        await writeFile(appPath, "<script>const broken = ;</script>\n", "utf8");
        await Bun.sleep(250);
        const failedResponse = await fetch(`http://localhost:${result.value.port}/main.ts`);
        const failedSource = await failedResponse.text();
        expect(failedResponse.status).toBe(500);
        expect(failedSource).toBe("Internal Server Error");

        await writeFile(appPath, validSource, "utf8");
        await Bun.sleep(250);
        const recoveredResponse = await fetch(`http://localhost:${result.value.port}/main.ts`);
        const recoveredSource = await recoveredResponse.text();
        expect(recoveredResponse.status).toBe(200);
        expect(recoveredSource).toContain("mount(App");
    } finally {
        await result.value.stop();
    }
});

test("native dev rebuilds its workspace when config and asset roots change", async () => {
    const rootDir = createTempRoot("native-config-restart");
    tempDirs.push(rootDir);

    await mkdir(join(rootDir, "src"), { recursive: true });
    await mkdir(join(rootDir, "assets"), { recursive: true });
    await writeFile(
        join(rootDir, "builder.ts"),
        'export default { appComponent: "src/App.svelte", appTitle: "Before", assetsDirs: ["assets"], port: 0 };\n',
        "utf8",
    );
    await writeFile(join(rootDir, "src", "App.svelte"), "<h1>native restart</h1>\n", "utf8");
    await writeFile(join(rootDir, "assets", "before.txt"), "before\n", "utf8");

    const result = await devModule.serve({ cwd: rootDir });
    expect(result.ok).toBe(true);
    if (!result.ok) {
        throw new Error(result.error);
    }

    const port = result.value.port;
    const origin = `http://127.0.0.1:${port}`;

    try {
        const initialResponse = await fetch(`${origin}/`);
        const initialHtml = await initialResponse.text();
        expect(initialResponse.status).toBe(200);
        expect(initialHtml).toContain("<title>Before</title>");
        expect(initialHtml).not.toContain("___live_reload");
        expect((await fetch(`${origin}/assets/before.txt`)).status).toBe(200);

        await mkdir(join(rootDir, "public"), { recursive: true });
        await writeFile(join(rootDir, "public", "after.txt"), "after\n", "utf8");
        await writeFile(
            join(rootDir, "builder.ts"),
            'export default { appComponent: "src/App.svelte", appTitle: "After", assetsDirs: ["public"], port: 0 };\n',
            "utf8",
        );

        await waitFor(async () => {
            const response = await fetch(`${origin}/`);
            const html = await response.text();
            return html.includes("<title>After</title>");
        });

        expect(result.value.port).toBe(port);
        expect((await fetch(`${origin}/public/after.txt`)).status).toBe(200);
        expect((await fetch(`${origin}/assets/before.txt`)).status).toBe(404);
    } finally {
        await result.value.stop();
    }
});
