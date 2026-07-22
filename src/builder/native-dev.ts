import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { createBootstrapSource, createImportPath, escapeHtml } from "./build-internals";
import { err, getErrorMessage, isPathWithinRoot, ok, type Result } from "./utils";

export type NativeDevWorkspaceOptions = {
    rootDir: string;
    sourceRoot: string;
    appComponentPath: string;
    appTitle: string;
    mountId: string;
    packageRoot: string;
    assets: Array<{ dirName: string; physicalPath: string }>;
};

export type NativeDevWorkspace = {
    rootDir: string;
    serverPath: string;
    watchRoot: string;
    cleanup: () => Promise<void>;
};

export type NativeDevServerHandle = {
    exited: Promise<number>;
    port: number;
    stop: () => Promise<void>;
};

export type NativeDevServerExitSupervisor = {
    expectExit: (server: NativeDevServerHandle) => void;
    observe: (
        server: NativeDevServerHandle,
        onUnexpectedExit: (server: NativeDevServerHandle, exitCode: number) => void,
    ) => void;
};

export const createNativeDevServerExitSupervisor = (): NativeDevServerExitSupervisor => {
    const expectedExits = new WeakSet<NativeDevServerHandle>();

    return {
        expectExit: (server) => {
            expectedExits.add(server);
        },
        observe: (server, onUnexpectedExit) => {
            void server.exited.then((exitCode) => {
                if (expectedExits.has(server)) return;
                onUnexpectedExit(server, exitCode);
            });
        },
    };
};

const NATIVE_SERVER_READY_TIMEOUT_MS = 5000;

const createPluginShimSource = (
    packageRoot: string,
    rootDir: string,
    mountId: string,
): { mount: string; runtime: string; svelte: string } => {
    const internalsModule = JSON.stringify(pathToFileURL(join(packageRoot, "src", "builder", "build-internals.ts")).href);
    const svelteModule = JSON.stringify(pathToFileURL(join(packageRoot, "src", "builder", "svelte-plugin.ts")).href);

    return {
        mount: [
            `import { createMountTargetPlugin } from ${svelteModule};`,
            "",
            `export default createMountTargetPlugin(${JSON.stringify(mountId)});`,
            "",
        ].join("\n"),
        runtime: [
            `import { createSvelteRuntimeAliasPlugin } from ${internalsModule};`,
            "",
            `export default createSvelteRuntimeAliasPlugin(${JSON.stringify(rootDir)});`,
            "",
        ].join("\n"),
        svelte: [
            `import { createSvelteBunPlugin } from ${svelteModule};`,
            "",
            'export default createSvelteBunPlugin({ mode: "dev" });',
            "",
        ].join("\n"),
    };
};

const createIndexHtml = (appTitle: string, mountId: string): string =>
    [
        "<!doctype html>",
        '<html lang="en">',
        "<head>",
        '    <meta charset="utf-8">',
        '    <meta name="viewport" content="width=device-width, initial-scale=1">',
        `    <title>${escapeHtml(appTitle)}</title>`,
        "</head>",
        "<body>",
        `    <main id="${escapeHtml(mountId)}"></main>`,
        '    <script type="module" src="./main.ts"></script>',
        "</body>",
        "</html>",
        "",
    ].join("\n");

const createNativeServerSource = (
    rootDir: string,
    sourceRoot: string,
    packageRoot: string,
    assets: Array<{ dirName: string; physicalPath: string }>,
): string => {
    const internalsModule = JSON.stringify(pathToFileURL(join(packageRoot, "src", "builder", "build-internals.ts")).href);

    return [
        'import { realpathSync, statSync } from "node:fs";',
        'import { dirname, isAbsolute, join, relative } from "node:path";',
        'import page from "./index.html";',
        'import mountPlugin from "./mount-plugin.ts";',
        'import runtimePlugin from "./runtime-plugin.ts";',
        'import sveltePlugin from "./svelte-plugin.ts";',
        `import { validateLocalSourceImportGraph } from ${internalsModule};`,
        "",
        `const rootDir = ${JSON.stringify(rootDir)};`,
        `const sourceRoot = ${JSON.stringify(sourceRoot)};`,
        `const assetRoots = ${JSON.stringify(assets)};`,
        "",
        "const isInside = (root, candidate) => {",
        "    const relativePath = relative(root, candidate);",
        '    return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));',
        "};",
        "",
        "const resolveAssetPath = (pathname) => {",
        "    for (const asset of assetRoots) {",
        "        const prefix = `/${asset.dirName}/`;",
        "        if (!pathname.startsWith(prefix)) continue;",
        "",
        "        const segments = pathname.slice(prefix.length).split(\"/\");",
        "        let decodedSegments;",
        "        try {",
        "            decodedSegments = segments.map((segment) => decodeURIComponent(segment));",
        "        } catch {",
        "            return null;",
        "        }",
        "        if (decodedSegments.some((segment) => segment.length === 0 || segment === \".\" || segment === \"..\" || segment.includes(\"/\"))) {",
        "            return null;",
        "        }",
        "",
        "        const root = asset.physicalPath;",
        "        const requestedPath = join(root, ...decodedSegments);",
        "        if (!isInside(root, requestedPath)) return null;",
        "",
        "        try {",
        "            const physicalPath = realpathSync(requestedPath);",
        "            if (!isInside(root, physicalPath) || !statSync(physicalPath).isFile()) return null;",
        "            return physicalPath;",
        "        } catch {",
        "            return null;",
        "        }",
        "    }",
        "",
        "    return null;",
        "};",
        "",
        "const isSupportedSourceModule = (pathname) => /\\.(?:ts|js|mjs|svelte)$/.test(pathname) && !pathname.endsWith(\".d.ts\");",
        "const isSvelteSourceModule = (pathname) => /\\.svelte(?:\\.(?:ts|js))?$/.test(pathname);",
        "",
        "const findNodeModulesRoot = (startDir) => {",
        "    let currentDir = startDir;",
        "    while (true) {",
        "        const candidate = join(currentDir, \"node_modules\", \"svelte\", \"package.json\");",
        "        try {",
        "            if (statSync(candidate).isFile()) return dirname(dirname(candidate));",
        "        } catch {}",
        "        const parentDir = dirname(currentDir);",
        "        if (parentDir === currentDir) return null;",
        "        currentDir = parentDir;",
        "    }",
        "};",
        "",
        "const nodeModulesRoot = findNodeModulesRoot(rootDir);",
        "",
        "const resolveNodeModulePath = (pathname) => {",
        '    const prefix = "/_node_modules/";',
        "    if (!pathname.startsWith(prefix) || nodeModulesRoot === null) return null;",
        "",
        "    let segments;",
        "    try {",
        "        segments = pathname.slice(prefix.length).split(\"/\").map((segment) => decodeURIComponent(segment));",
        "    } catch {",
        "        return null;",
        "    }",
        "    if (segments.some((segment) => segment.length === 0 || segment === \".\" || segment === \"..\" || segment.includes(\"/\"))) {",
        "        return null;",
        "    }",
        "",
        "    const packageSegmentCount = segments[0]?.startsWith(\"@\") ? 2 : 1;",
        "    if (segments.length <= packageSegmentCount) return null;",
        "    const packagePath = join(nodeModulesRoot, ...segments.slice(0, packageSegmentCount));",
        "    let packageRoot;",
        "    try {",
        "        packageRoot = dirname(realpathSync(join(packagePath, \"package.json\")));",
        "    } catch {",
        "        return null;",
        "    }",
        "",
        "    const requestedPath = join(packagePath, ...segments.slice(packageSegmentCount));",
        "    try {",
        "        const physicalPath = realpathSync(requestedPath);",
        "        if (!isInside(packageRoot, physicalPath) || !statSync(physicalPath).isFile()) return null;",
        "        return physicalPath;",
        "    } catch {",
        "        return null;",
        "    }",
        "};",
        "",
        "const resolveSourcePath = (pathname) => {",
        "    if (!isSupportedSourceModule(pathname)) return null;",
        "",
        "    let decodedSegments;",
        "    try {",
        "        decodedSegments = pathname.split(\"/\").filter(Boolean).map((segment) => decodeURIComponent(segment));",
        "    } catch {",
        "        return null;",
        "    }",
        "    if (decodedSegments.some((segment) => segment.length === 0 || segment === \".\" || segment === \"..\" || segment.includes(\"/\"))) {",
        "        return null;",
        "    }",
        "",
        "    const requestedPath = join(rootDir, ...decodedSegments);",
        "    if (!isInside(rootDir, requestedPath)) return null;",
        "",
        "    try {",
        "        const physicalPath = realpathSync(requestedPath);",
        "        if (!isInside(sourceRoot, physicalPath) || !statSync(physicalPath).isFile()) return null;",
        "        return physicalPath;",
        "    } catch {",
        "        return null;",
        "    }",
        "};",
        "",
        "const createBuildErrorResponse = () => new Response(\"Internal Server Error\", { status: 500 });",
        "",
        "const buildModuleResponse = async (entrypoint, allowedRoots) => {",
        "    try {",
        "        if (allowedRoots !== undefined) {",
        "            const validation = await validateLocalSourceImportGraph(entrypoint, allowedRoots);",
        "            if (!validation.ok) return createBuildErrorResponse();",
        "        }",
        "        const bundle = await Bun.build({",
        "            entrypoints: [entrypoint],",
        '            external: ["svelte", "svelte/*", "esm-env"],',
        "            format: \"esm\",",
        "            plugins: [runtimePlugin, mountPlugin, sveltePlugin],",
        "            splitting: false,",
        "            target: \"browser\",",
        "            write: false,",
        "        });",
        "        if (!bundle.success) return createBuildErrorResponse();",
        "        const output = bundle.outputs.find((asset) => asset.kind === \"entry-point\") ?? bundle.outputs[0];",
        "        if (output === undefined) return createBuildErrorResponse();",
        "        return new Response(await output.text(), { headers: { \"Content-Type\": \"application/javascript\" } });",
        "    } catch {",
        "        return createBuildErrorResponse();",
        "    }",
        "};",
        "",
        "const server = Bun.serve({",
        "    development: { hmr: true },",
        '    port: Number(process.env.SVELTE_NATIVE_DEV_PORT ?? "0"),',
        '    routes: { "/": page },',
        "    fetch: async (request) => {",
        "        if (request.method !== \"GET\" && request.method !== \"HEAD\") {",
        "            return new Response(\"Method Not Allowed\", { status: 405, headers: { Allow: \"GET, HEAD\" } });",
        "        }",
        "        const pathname = new URL(request.url).pathname;",
        "        if (pathname === \"/favicon.ico\") return new Response(null, { status: 204 });",
        "        if (pathname === \"/main.ts\") return buildModuleResponse(join(import.meta.dir, \"main.ts\"), [sourceRoot]);",
        "        const nodeModulePath = resolveNodeModulePath(pathname);",
        "        if (nodeModulePath !== null) {",
        "            if (isSvelteSourceModule(nodeModulePath)) return buildModuleResponse(nodeModulePath);",
        "            return new Response(Bun.file(nodeModulePath));",
        "        }",
        "        const sourcePath = resolveSourcePath(pathname);",
        "        if (sourcePath !== null) return buildModuleResponse(sourcePath, [sourceRoot]);",
        "        const assetPath = resolveAssetPath(pathname);",
        "        return assetPath === null ? new Response(\"Not Found\", { status: 404 }) : new Response(Bun.file(assetPath));",
        "    },",
        "    error: () => new Response(\"Internal Server Error\", { status: 500 }),",
        "});",
        "",
        "console.log(JSON.stringify({ port: server.port }));",
        "",
    ].join("\n");
};

export const createNativeDevWorkspace = async (
    options: NativeDevWorkspaceOptions,
): Promise<Result<NativeDevWorkspace>> => {
    const rootDir = resolve(options.rootDir);
    const sourceRoot = resolve(options.sourceRoot);
    const appComponentPath = resolve(options.appComponentPath);
    const packageRoot = resolve(options.packageRoot);
    if (!isPathWithinRoot(rootDir, sourceRoot)) {
        return err(`Native dev source root escaped consumer root: ${sourceRoot}`);
    }
    if (!isPathWithinRoot(sourceRoot, appComponentPath)) {
        return err(`Native dev app component escaped consumer root: ${appComponentPath}`);
    }

    let workspaceRoot: string;
    try {
        workspaceRoot = await mkdtemp(join(tmpdir(), "svelte-lib-native-dev-"));
    } catch (error) {
        return err(`Failed to create native dev workspace: ${getErrorMessage(error)}`);
    }

    let cleaned = false;
    const cleanup = async (): Promise<void> => {
        if (cleaned) return;
        cleaned = true;
        await rm(workspaceRoot, { force: true, recursive: true }).catch(() => undefined);
    };

    try {
        const pluginShims = createPluginShimSource(packageRoot, rootDir, options.mountId);
        await symlink(sourceRoot, join(workspaceRoot, "app"), "dir");
        await Promise.all([
            writeFile(
                join(workspaceRoot, "bunfig.toml"),
                '[serve.static]\nplugins = ["./runtime-plugin.ts", "./mount-plugin.ts", "./svelte-plugin.ts"]\n',
                "utf8",
            ),
            writeFile(join(workspaceRoot, "index.html"), createIndexHtml(options.appTitle, options.mountId), "utf8"),
            writeFile(
                join(workspaceRoot, "main.ts"),
                createBootstrapSource(
                    createImportPath(workspaceRoot, join(workspaceRoot, "app", relative(sourceRoot, appComponentPath))),
                    options.mountId,
                    true,
                ),
                "utf8",
            ),
            writeFile(join(workspaceRoot, "runtime-plugin.ts"), pluginShims.runtime, "utf8"),
            writeFile(join(workspaceRoot, "mount-plugin.ts"), pluginShims.mount, "utf8"),
            writeFile(join(workspaceRoot, "svelte-plugin.ts"), pluginShims.svelte, "utf8"),
            writeFile(
                join(workspaceRoot, "server.ts"),
                createNativeServerSource(rootDir, sourceRoot, packageRoot, options.assets),
                "utf8",
            ),
        ]);
    } catch (error) {
        await cleanup();
        return err(`Failed to write native dev workspace: ${getErrorMessage(error)}`);
    }

    return ok({
        cleanup,
        rootDir: workspaceRoot,
        serverPath: join(workspaceRoot, "server.ts"),
        watchRoot: rootDir,
    });
};

type NativeDevProcess = ReturnType<typeof Bun.spawn>;

const readReadyPort = async (child: NativeDevProcess): Promise<Result<number>> => {
    const stdout = child.stdout;
    if (!(stdout instanceof ReadableStream)) {
        return err("Native dev server stdout is not readable.");
    }

    const reader = stdout.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
        while (true) {
            const chunk = await reader.read();
            if (chunk.done) {
                return err("Native dev server exited before reporting a ready port.");
            }

            buffer += decoder.decode(chunk.value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
                try {
                    const parsed = JSON.parse(line) as { port?: unknown };
                    if (typeof parsed.port === "number" && Number.isInteger(parsed.port) && parsed.port > 0) {
                        return ok(parsed.port);
                    }
                } catch {
                    continue;
                }
            }
        }
    } catch (error) {
        return err(`Failed to read native dev server readiness: ${getErrorMessage(error)}`);
    } finally {
        reader.releaseLock();
    }
};

const stopNativeDevProcess = async (child: NativeDevProcess): Promise<void> => {
    if (!child.killed && child.exitCode === null) {
        child.kill();
    }
    await child.exited;
};

export const startNativeDevServer = async (
    workspace: NativeDevWorkspace,
    port: number,
): Promise<Result<NativeDevServerHandle>> => {
    if (!Number.isInteger(port) || port < 0 || port > 65535) {
        return err(`Invalid native dev port: ${port}`);
    }

    let child: NativeDevProcess;
    try {
        child = Bun.spawn([process.execPath, `--config=${join(workspace.rootDir, "bunfig.toml")}`, workspace.serverPath], {
            cwd: workspace.watchRoot,
            env: { ...process.env, SVELTE_NATIVE_DEV_PORT: String(port) },
            stderr: "pipe",
            stdout: "pipe",
        });
    } catch (error) {
        await workspace.cleanup();
        return err(`Failed to start native dev server: ${getErrorMessage(error)}`);
    }

    const readyPromise = readReadyPort(child);
    const ready = await Promise.race([
        readyPromise,
        Bun.sleep(NATIVE_SERVER_READY_TIMEOUT_MS).then(() => err("Native dev server did not become ready in time.")),
    ]);
    if (!ready.ok) {
        await stopNativeDevProcess(child);
        await readyPromise;
        await workspace.cleanup();
        return ready;
    }

    let stopped = false;
    return ok({
        exited: child.exited,
        port: ready.value,
        stop: async () => {
            if (stopped) return;
            stopped = true;
            await stopNativeDevProcess(child);
            await workspace.cleanup();
        },
    });
};
