import { afterEach, expect, test } from "bun:test";
import { mkdir, realpath, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
    createNativeDevServerExitSupervisor,
    createNativeDevWorkspace,
    startNativeDevServer,
    type NativeDevServerHandle,
} from "../native-dev";

const tempRoots: string[] = [];

const createTempRoot = (name: string): string =>
    join(process.cwd(), ".tmp", `svelte-builder-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`);

afterEach(async () => {
    await Promise.all(tempRoots.splice(0).map((rootDir) => rm(rootDir, { force: true, recursive: true })));
});

test("creates an isolated native dev workspace manifest", async () => {
    const consumerRoot = createTempRoot("native-dev-workspace");
    tempRoots.push(consumerRoot);
    await mkdir(join(consumerRoot, "src"), { recursive: true });
    await writeFile(join(consumerRoot, "src", "App.svelte"), "<h1>native</h1>\n", "utf8");

    const appComponentPath = join(consumerRoot, "src", "App.svelte");
    const result = await createNativeDevWorkspace({
        appComponentPath,
        appTitle: "Native HMR",
        assets: [],
        mountId: "native-root",
        packageRoot: process.cwd(),
        rootDir: consumerRoot,
        sourceRoot: join(consumerRoot, "src"),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    try {
        const workspace = result.value;
        expect(workspace.watchRoot).toBe(consumerRoot);
        expect(await Bun.file(join(workspace.rootDir, "bunfig.toml")).exists()).toBe(true);
        expect(await Bun.file(join(workspace.rootDir, "index.html")).exists()).toBe(true);
        expect(await Bun.file(join(workspace.rootDir, "main.ts")).exists()).toBe(true);
        expect(await Bun.file(workspace.serverPath).exists()).toBe(true);
        expect(await realpath(join(workspace.rootDir, "app"))).toBe(join(consumerRoot, "src"));

        const bunfig = await Bun.file(join(workspace.rootDir, "bunfig.toml")).text();
        const html = await Bun.file(join(workspace.rootDir, "index.html")).text();
        const entry = await Bun.file(join(workspace.rootDir, "main.ts")).text();
        expect(bunfig).toContain("[serve.static]");
        expect(bunfig).toContain("plugins");
        expect(html).toContain('id="native-root"');
        expect(entry).toContain("./app/App.svelte");
        expect(entry).toContain("import.meta.hot.accept");
        expect(entry).toContain('scope.createElement("div")');
        expect(entry).toContain("body.append(target)");
        expect(entry).not.toContain("Missing mount target");
        expect(await Bun.file(join(consumerRoot, "bunfig.toml")).exists()).toBe(false);
    } finally {
        await result.value.cleanup();
    }
});

test("native server lifecycle serves the generated HTML route", async () => {
    const consumerRoot = createTempRoot("native-dev-server");
    tempRoots.push(consumerRoot);
    await mkdir(join(consumerRoot, "src"), { recursive: true });
    await writeFile(join(consumerRoot, "src", "App.svelte"), "<h1>native server</h1>\n", "utf8");

    const workspaceResult = await createNativeDevWorkspace({
        appComponentPath: join(consumerRoot, "src", "App.svelte"),
        appTitle: "Native HMR",
        assets: [],
        mountId: "app",
        packageRoot: process.cwd(),
        rootDir: consumerRoot,
        sourceRoot: join(consumerRoot, "src"),
    });
    expect(workspaceResult.ok).toBe(true);
    if (!workspaceResult.ok) return;

    const serverResult = await startNativeDevServer(workspaceResult.value, 0);
    expect(serverResult.ok).toBe(true);
    if (!serverResult.ok) {
        await workspaceResult.value.cleanup();
        return;
    }

    try {
        const pageResponse = await fetch(`http://127.0.0.1:${serverResult.value.port}/`);
        const html = await pageResponse.text();
        const scriptPath = html.match(/<script[^>]+src="([^"]+)"/)?.[1];
        const scriptResponse = scriptPath
            ? await fetch(new URL(scriptPath, `http://127.0.0.1:${serverResult.value.port}/`))
            : null;

        expect(pageResponse.status).toBe(200);
        expect(scriptResponse?.status).toBe(200);
    } finally {
        await serverResult.value.stop();
    }
});

test("native server exposes natural child exit and still cleans up", async () => {
    const consumerRoot = createTempRoot("native-dev-exit");
    tempRoots.push(consumerRoot);
    await mkdir(join(consumerRoot, "src"), { recursive: true });
    await writeFile(join(consumerRoot, "src", "App.svelte"), "<h1>native exit</h1>\n", "utf8");

    const workspaceResult = await createNativeDevWorkspace({
        appComponentPath: join(consumerRoot, "src", "App.svelte"),
        appTitle: "Native Exit",
        assets: [],
        mountId: "app",
        packageRoot: process.cwd(),
        rootDir: consumerRoot,
        sourceRoot: join(consumerRoot, "src"),
    });
    expect(workspaceResult.ok).toBe(true);
    if (!workspaceResult.ok) return;

    await writeFile(
        workspaceResult.value.serverPath,
        [
            'const server = Bun.serve({ port: Number(process.env.SVELTE_NATIVE_DEV_PORT ?? "0"), fetch: () => new Response("ok") });',
            "console.log(JSON.stringify({ port: server.port }));",
            "setTimeout(() => process.exit(17), 50);",
            "",
        ].join("\n"),
        "utf8",
    );

    const serverResult = await startNativeDevServer(workspaceResult.value, 0);
    expect(serverResult.ok).toBe(true);
    if (!serverResult.ok) return;

    try {
        const exited = serverResult.value.exited;
        expect(exited).toBeInstanceOf(Promise);
        await expect(exited).resolves.toBe(17);
    } finally {
        await serverResult.value.stop();
    }

    expect(await Bun.file(workspaceResult.value.rootDir).exists()).toBe(false);
});

test("native server exit supervisor reports unexpected exits only", async () => {
    const supervisor = createNativeDevServerExitSupervisor();
    const createServer = (exited: Promise<number>): NativeDevServerHandle => ({
        exited,
        port: 1,
        stop: async () => undefined,
    });

    let unexpectedExit: number | undefined;
    let resolveNaturalExit: ((exitCode: number) => void) | undefined;
    const naturalServer = createServer(
        new Promise<number>((resolve) => {
            resolveNaturalExit = resolve;
        }),
    );
    const expectedServer = createServer(Promise.resolve(0));

    supervisor.expectExit(expectedServer);
    supervisor.observe(expectedServer, (_server, exitCode) => {
        unexpectedExit = exitCode;
    });
    supervisor.observe(naturalServer, (_server, exitCode) => {
        unexpectedExit = exitCode;
    });

    await Bun.sleep(0);
    expect(unexpectedExit).toBeUndefined();

    resolveNaturalExit?.(17);
    await naturalServer.exited;
    await Bun.sleep(0);
    expect(unexpectedExit).toBe(17);
});

test("native server enforces configured asset and path policy", async () => {
    const consumerRoot = createTempRoot("native-dev-policy");
    tempRoots.push(consumerRoot);
    const assetsRoot = join(consumerRoot, "assets");
    await mkdir(join(consumerRoot, "src"), { recursive: true });
    await mkdir(assetsRoot, { recursive: true });
    await writeFile(join(consumerRoot, "src", "App.svelte"), "<h1>native policy</h1>\n", "utf8");
    await writeFile(join(consumerRoot, "src", "types.d.ts"), "export type NativePolicy = string;\n", "utf8");
    await writeFile(join(consumerRoot, "src", "escape.ts"), 'import config from "../builder.ts"; export default config;\n', "utf8");
    await writeFile(join(consumerRoot, "builder.ts"), "export default {};\n", "utf8");
    await writeFile(join(assetsRoot, "hello.txt"), "native asset\n", "utf8");

    const workspaceResult = await createNativeDevWorkspace({
        appComponentPath: join(consumerRoot, "src", "App.svelte"),
        appTitle: "Native HMR",
        assets: [{ dirName: "assets", physicalPath: assetsRoot }],
        mountId: "app",
        packageRoot: process.cwd(),
        rootDir: consumerRoot,
        sourceRoot: join(consumerRoot, "src"),
    });
    expect(workspaceResult.ok).toBe(true);
    if (!workspaceResult.ok) return;

    const serverResult = await startNativeDevServer(workspaceResult.value, 0);
    expect(serverResult.ok).toBe(true);
    if (!serverResult.ok) {
        await workspaceResult.value.cleanup();
        return;
    }

    try {
        const origin = `http://127.0.0.1:${serverResult.value.port}`;
        const assetResponse = await fetch(`${origin}/assets/hello.txt`);
        const builderResponse = await fetch(`${origin}/builder.ts`);
        const traversalResponse = await fetch(`${origin}/assets/%2e%2e/builder.ts`);
        const unknownResponse = await fetch(`${origin}/unknown`);
        const declarationResponse = await fetch(`${origin}/src/types.d.ts`);
        const escapedSourceResponse = await fetch(`${origin}/src/escape.ts`);
        const faviconResponse = await fetch(`${origin}/favicon.ico`);

        expect(assetResponse.status).toBe(200);
        expect(await assetResponse.text()).toBe("native asset\n");
        expect(builderResponse.status).toBe(404);
        expect(traversalResponse.status).toBe(404);
        expect(unknownResponse.status).toBe(404);
        expect(declarationResponse.status).toBe(404);
        expect(escapedSourceResponse.status).toBe(500);
        expect(await escapedSourceResponse.text()).toBe("Internal Server Error");
        expect(faviconResponse.status).toBe(204);
    } finally {
        await serverResult.value.stop();
    }
});
