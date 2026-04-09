#!/usr/bin/env bun

import { randomInt } from "node:crypto";
import { existsSync, lstatSync, realpathSync, statSync, type FSWatcher } from "node:fs";
import { dirname, isAbsolute, join, relative } from "node:path";
import { gzipSync } from "node:zlib";
import type { ErrorLike, Server } from "bun";
import { compile } from "svelte/compiler";
import {
    createHtmlShell,
    type BuildSvelteOptions,
    type Result,
    loadSvelteConfig,
    validateLocalSourceImportGraph,
} from "./build";
import { createBootstrapSource, createImportPath } from "./bootstrap";
import { resolvePhysicalAssetPath } from "./assets";
import { deriveDevRuntimeState, type DevRuntimeState } from "./dev-config";
import { resolveDevStaticAssetRequest } from "./dev-assets";
import { DEV_SPECIAL_IMPORTS, resolveBareImportPathForDev, rewriteBareImportsForDev } from "./dev-imports";
import { createDevReloadHub, createSSEResponse, type DevReloadHub } from "./dev-reload";
import { formatAssetReport } from "./report";
import {
    isSupportedJavaScriptSourceModule,
    isSupportedLocalSourceModule,
    isSupportedSvelteSourceModule,
    isSupportedTypeScriptSourceModule,
} from "./source-modules";

export type DevServerHandle = {
    port: number;
    stop: () => Promise<void>;
};

export { resolveDevWatchRoots } from "./dev-config";
export type { DevRuntimeState, DevWatchRoot } from "./dev-config";

export type DevCliDependencies = {
    cwd?: string;
    error?: (message: string) => void;
    log?: (message: string) => void;
    run?: (cwd: string) => Promise<Result<DevServerHandle>>;
};

export { resolveBareImportPathForDev } from "./dev-imports";
export { attachDevWatcherErrorHandler, classifyDevWatchTarget, formatDevWatcherIssue, shouldProcessDevWatchEvent } from "./dev-reload";

const ok = <T>(value: T): Result<T> => ({ ok: true, value });

const fail = (error: string): Result<never> => ({ ok: false, error });

const DEV_PORT_RETRY_LIMIT = 8;
const DEV_PORT_RANGE_MAX = 65535;
const DEV_PORT_RANGE_MIN = 49152;
const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) {
        return error.message;
    }

    return String(error);
};

const getErrorCode = (error: unknown): string | undefined =>
    error instanceof Error && "code" in error && typeof error.code === "string" ? error.code : undefined;

const escapeHtml = (value: string): string =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const createNotFoundResponse = (): Response => new Response("Not Found", { status: 404 });
const createMethodNotAllowedResponse = (): Response =>
    new Response("Method Not Allowed", {
        status: 405,
        headers: { Allow: "GET, HEAD" },
    });
const normalizeModulePath = (value: string): string => value.replace(/\\/g, "/");
const DEV_LIVE_RELOAD_PATH = "/___live_reload";
const DEV_INTERNAL_PATH_PREFIXES = ["/_node_modules/", "/_virtual/"] as const;

const createDevLiveReloadScript = (): string =>
    [
        "<script>",
        `    const source = new EventSource(${JSON.stringify(DEV_LIVE_RELOAD_PATH)});`,
        "    source.onmessage = (event) => {",
        '        if (event.data === "reload") {',
        "            source.close();",
        "            location.reload();",
        "        }",
        "    };",
        "</script>",
    ].join("\n");

const createDevHtmlShell = (importMapScript: string, mountId: string, appTitle: string): string =>
    [
        "<!DOCTYPE html>",
        '<html lang="en">',
        "<head>",
        '    <meta charset="UTF-8">',
        '    <meta name="viewport" content="width=device-width, initial-scale=1.0">',
        `    <title>${escapeHtml(appTitle)}</title>`,
        `    ${importMapScript}`,
        "</head>",
        "<body>",
        `    ${createHtmlShell(mountId, appTitle).appHtml}`,
        `    ${createDevLiveReloadScript()}`,
        '    <script type="module" src="/main.ts"></script>',
        "</body>",
        "</html>",
    ].join("\n");

const shouldServeDevAppShell = (method: string, pathname: string, sourcePathPrefix: string | undefined): boolean => {
    if (method !== "GET" && method !== "HEAD") {
        return false;
    }

    if (pathname === "/") {
        return false;
    }

    if (pathname === "/main.ts" || pathname === DEV_LIVE_RELOAD_PATH || pathname === "/_virtual/esm-env.js") {
        return false;
    }

    if (DEV_INTERNAL_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
        return false;
    }

    if (sourcePathPrefix !== undefined && pathname.startsWith(sourcePathPrefix)) {
        return false;
    }

    const lastSegment = pathname.split("/").pop() ?? "";
    return !lastSegment.includes(".");
};

const createRecompiledAssetReport = (modulePath: string, contents: string): string =>
    formatAssetReport(
        "Recompiled assets",
        [
            {
                file: modulePath,
                gzip: gzipSync(contents).byteLength,
                size: Buffer.byteLength(contents),
                time: new Date().toISOString().replace("T", " ").slice(0, 19),
            },
        ],
        { includeTime: true },
    );

const logRecompiledAsset = (modulePath: string, contents: string): void => {
    console.log(createRecompiledAssetReport(modulePath, contents));
};

const isCompilableDevModule = (filePath: string): boolean => isSupportedLocalSourceModule(filePath);

type DevCompileCacheEntry = {
    contents: string;
    mtimeMs: number;
};

export type DevCompileCache = {
    invalidate: (cacheKey: string) => void;
    read: (cacheKey: string, mtimeMs: number) => string | undefined;
    write: (cacheKey: string, mtimeMs: number, contents: string) => void;
};

export const createDevCompileCache = (): DevCompileCache => {
    const entries = new Map<string, DevCompileCacheEntry>();

    return {
        invalidate: (cacheKey) => {
            entries.delete(cacheKey);
        },
        read: (cacheKey, mtimeMs) => {
            const entry = entries.get(cacheKey);
            if (entry === undefined || entry.mtimeMs !== mtimeMs) {
                return undefined;
            }

            return entry.contents;
        },
        write: (cacheKey, mtimeMs, contents) => {
            entries.set(cacheKey, { contents, mtimeMs });
        },
    };
};

export const createDevCompileCacheKey = (rootDir: string, modulePath: string): string =>
    normalizeModulePath(join(rootDir, modulePath));

const getDevModuleMtime = (rootDir: string, modulePath: string): Result<number> => {
    try {
        return ok(statSync(join(rootDir, modulePath)).mtimeMs);
    } catch (error) {
        return fail(`Missing file: ${join(rootDir, modulePath)} (${getErrorMessage(error)})`);
    }
};

const loadUncachedDevModule = async (rootDir: string, modulePath: string, shouldLog = false): Promise<Result<string>> => {
    if (isSupportedSvelteSourceModule(modulePath)) {
        return compileSvelteForDev(rootDir, modulePath, shouldLog);
    }

    if (isSupportedJavaScriptSourceModule(modulePath)) {
        const source = await loadRequiredText(join(rootDir, modulePath));
        if (!source.ok) {
            return source;
        }

        const rewritten = await rewriteBareImportsForDev(source.value, join(rootDir, modulePath));
        if (!rewritten.ok) {
            return rewritten;
        }

        if (shouldLog) {
            logRecompiledAsset(modulePath, rewritten.value);
        }

        return ok(rewritten.value);
    }

    if (isSupportedTypeScriptSourceModule(modulePath)) {
        return transpileTypeScriptForDev(rootDir, modulePath, shouldLog);
    }

    return fail(`Unsupported dev module: ${modulePath}`);
};

const loadDevModule = async (
    rootDir: string,
    modulePath: string,
    cache: DevCompileCache,
    allowedRoots?: string[],
    shouldLog = false,
): Promise<Result<string>> => {
    if (allowedRoots !== undefined && isCompilableDevModule(modulePath)) {
        const validatedImportGraph = await validateLocalSourceImportGraph(join(rootDir, modulePath), allowedRoots);
        if (!validatedImportGraph.ok) {
            return validatedImportGraph;
        }
    }

    const mtime = getDevModuleMtime(rootDir, modulePath);
    if (!mtime.ok) {
        return mtime;
    }

    const cacheKey = createDevCompileCacheKey(rootDir, modulePath);
    const cached = cache.read(cacheKey, mtime.value);
    if (cached !== undefined) {
        return ok(cached);
    }

    const loaded = await loadUncachedDevModule(rootDir, modulePath, shouldLog);
    if (!loaded.ok) {
        return loaded;
    }

    cache.write(cacheKey, mtime.value, loaded.value);
    return loaded;
};

const compileChangedDevAsset = async (
    rootDir: string,
    modulePath: string,
    cache: DevCompileCache,
    allowedRoots: string[],
): Promise<void> => {
    cache.invalidate(createDevCompileCacheKey(rootDir, modulePath));
    const compiled = await loadDevModule(rootDir, modulePath, cache, allowedRoots, true);
    if (!compiled.ok) {
        console.error(compiled.error);
    }
};

const createInternalServerErrorResponse = (): Response => new Response("Internal Server Error", { status: 500 });

const createDevModuleErrorResponse = (error: string): Response => {
    if (error.startsWith("Missing file:")) {
        return createNotFoundResponse();
    }

    console.error(error);
    return createInternalServerErrorResponse();
};

const getRawRequestPathname = (requestUrl: string): string => {
    const schemeIndex = requestUrl.indexOf("://");
    const pathnameStart = schemeIndex === -1 ? requestUrl.indexOf("/") : requestUrl.indexOf("/", schemeIndex + 3);
    const pathnameWithQuery = pathnameStart === -1 ? "/" : requestUrl.slice(pathnameStart);
    const queryStart = pathnameWithQuery.search(/[?#]/);

    return queryStart === -1 ? pathnameWithQuery : pathnameWithQuery.slice(0, queryStart);
};

const isPathInsideRoot = (rootDir: string, targetPath: string): boolean => {
    const relativePath = relative(rootDir, targetPath);

    return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
};

const resolveDevRequestPath = async (
    rootDir: string,
    rawPathname: string,
    prefix: string,
): Promise<Result<{ filePath: string; modulePath: string; resolvedPath: string }>> => {
    const encodedPath = prefix === "/" ? rawPathname.slice(1) : rawPathname.slice(prefix.length);
    let decodedPath: string;

    try {
        decodedPath = decodeURIComponent(encodedPath);
    } catch {
        return fail("Rejected path");
    }

    const segments: string[] = [];
    for (const segment of decodedPath.replace(/\\/g, "/").split("/")) {
        if (segment.length === 0 || segment === ".") {
            continue;
        }

        if (segment === "..") {
            return fail("Rejected path");
        }

        segments.push(segment);
    }

    if (segments.length === 0) {
        return fail("Rejected path");
    }

    const modulePath = segments.join("/");
    const filePath = join(rootDir, modulePath);
    const pathStatus = (() => {
        try {
            return lstatSync(filePath);
        } catch {
            return undefined;
        }
    })();

    if (pathStatus?.isSymbolicLink()) {
        try {
            const realRootDir = realpathSync(rootDir);
            const realFilePath = realpathSync(filePath);
            if (!isPathInsideRoot(realRootDir, realFilePath)) {
                return fail("Rejected path");
            }

            return ok({ filePath, modulePath, resolvedPath: realFilePath });
        } catch {
            return fail("Rejected path");
        }
    }

    if (!(await Bun.file(filePath).exists())) {
        return ok({ filePath, modulePath, resolvedPath: filePath });
    }

    const realRootDir = realpathSync(rootDir);
    const realFilePath = realpathSync(filePath);
    if (!isPathInsideRoot(realRootDir, realFilePath)) {
        return fail("Rejected path");
    }

    return ok({ filePath, modulePath, resolvedPath: realFilePath });
};

const getNodeModulePackageNameSegments = (segments: string[]): string[] => {
    if (segments[0]?.startsWith("@")) {
        return segments.length >= 2 ? segments.slice(0, 2) : [];
    }

    return segments.length >= 1 ? segments.slice(0, 1) : [];
};

const resolveDevNodeModuleRequestPath = async (
    nodeModulesRoot: string,
    rawPathname: string,
): Promise<Result<{ filePath: string; modulePath: string; packageRoot: string; resolvedPath: string }>> => {
    const encodedPath = rawPathname.slice("/_node_modules/".length);
    let decodedPath: string;

    try {
        decodedPath = decodeURIComponent(encodedPath);
    } catch {
        return fail("Rejected path");
    }

    const segments: string[] = [];
    for (const segment of decodedPath.replace(/\\/g, "/").split("/")) {
        if (segment.length === 0 || segment === ".") {
            continue;
        }

        if (segment === "..") {
            return fail("Rejected path");
        }

        segments.push(segment);
    }

    const packageNameSegments = getNodeModulePackageNameSegments(segments);
    if (packageNameSegments.length === 0 || segments.length <= packageNameSegments.length) {
        return fail("Rejected path");
    }

    const packagePath = join(nodeModulesRoot, ...packageNameSegments);
    let packageRoot: string;
    try {
        packageRoot = dirname(realpathSync(join(packagePath, "package.json")));
    } catch {
        return fail("Rejected path");
    }

    const moduleSegments = segments.slice(packageNameSegments.length);
    const modulePath = moduleSegments.join("/");
    const filePath = join(packagePath, modulePath);

    if (!(await Bun.file(filePath).exists())) {
        return ok({ filePath, modulePath, packageRoot, resolvedPath: filePath });
    }

    let resolvedPath: string;
    try {
        resolvedPath = realpathSync(filePath);
    } catch {
        return fail("Rejected path");
    }

    if (!isPathInsideRoot(packageRoot, resolvedPath)) {
        return fail("Rejected path");
    }

    return ok({ filePath, modulePath, packageRoot, resolvedPath });
};

export const findNodeModulesRoot = async (startDir: string): Promise<Result<string>> => {
    let current = startDir;
    let fallback: string | undefined;

    while (true) {
        const candidate = join(current, "node_modules", "svelte", "package.json");
        if (await Bun.file(candidate).exists()) {
            const nodeModulesDir = join(current, "node_modules");
            if (existsSync(join(nodeModulesDir, ".bun"))) {
                return ok(nodeModulesDir);
            }

            fallback ??= nodeModulesDir;
        }

        const parent = dirname(current);
        if (parent === current) {
            return fallback === undefined ? fail(`Unable to locate node_modules from ${startDir}`) : ok(fallback);
        }

        current = parent;
    }
};

const createImportMap = () => ({
    imports: DEV_SPECIAL_IMPORTS,
});

const loadRequiredText = async (path: string): Promise<Result<string>> => {
    const file = Bun.file(path);
    const exists = await file.exists();
    if (!exists) {
        return fail(`Missing file: ${path}`);
    }

    return file.text().then(
        (value) => ok(value),
        (error) => fail(`Failed to read ${path}: ${getErrorMessage(error)}`),
    );
};

const tsTranspiler = new Bun.Transpiler({ loader: "ts" });

const createCssInjection = (modulePath: string, cssCode: string | undefined): string => {
    if (!cssCode) {
        return "";
    }

    return [
        "(() => {",
        `    const id = ${JSON.stringify(modulePath)};`,
        '    if (!document.querySelector(`style[data-svelte-id="${id}"]`)) {',
        '        const style = document.createElement("style");',
        '        style.setAttribute("data-svelte-id", id);',
        `        style.textContent = ${JSON.stringify(cssCode)};`,
        "        document.head.appendChild(style);",
        "    }",
        "})();",
    ].join("\n");
};

const compileSvelteForDev = async (rootDir: string, modulePath: string, shouldLog = false): Promise<Result<string>> => {
    const source = await loadRequiredText(join(rootDir, modulePath));
    if (!source.ok) {
        return source;
    }

    return Promise.resolve()
        .then(() =>
            compile(source.value, {
                dev: true,
                filename: modulePath,
                generate: "client",
            }),
        )
        .then(
            ({ css, js }) => {
                const contents = js.code + createCssInjection(modulePath, css?.code);
                return rewriteBareImportsForDev(contents, join(rootDir, modulePath)).then((rewritten) => {
                    if (!rewritten.ok) {
                        return rewritten;
                    }

                    if (shouldLog) {
                        logRecompiledAsset(modulePath, rewritten.value);
                    }

                    return ok(rewritten.value);
                });
            },
            (error) => fail(`Failed to compile ${modulePath}: ${getErrorMessage(error)}`),
        );
};

const transpileTypeScriptForDev = async (rootDir: string, modulePath: string, shouldLog = false): Promise<Result<string>> => {
    const source = await loadRequiredText(join(rootDir, modulePath));
    if (!source.ok) {
        return source;
    }

    return Promise.resolve()
        .then(() => {
            const transformed = tsTranspiler.transformSync(source.value);
            return rewriteBareImportsForDev(transformed, join(rootDir, modulePath)).then((rewritten) => {
                if (!rewritten.ok) {
                    return rewritten;
                }

                if (shouldLog) {
                    logRecompiledAsset(modulePath, rewritten.value);
                }

                return ok(rewritten.value);
            });
        })
        .catch((error) => fail(`Failed to transpile ${modulePath}: ${getErrorMessage(error)}`));
};

const createServerHandle = (server: Server<undefined>): DevServerHandle => ({
    port: server.port ?? 0,
    stop: async () => {
        server.stop(true);
        await new Promise((resolve) => setTimeout(resolve, 100));
    },
});

const resolveDevPort = (config: BuildSvelteOptions): number => config.port ?? 3000;

const createEphemeralPortCandidate = (): number => randomInt(DEV_PORT_RANGE_MIN, DEV_PORT_RANGE_MAX + 1);

type BunServeOptions = Parameters<typeof Bun.serve>[0];
type DevFetchHandler = (req: Request) => Response | Promise<Response>;
type DevErrorHandler = (error: ErrorLike) => Response | Promise<Response> | void | Promise<void>;

const startServer = async (
    config: BuildSvelteOptions,
    fetch: DevFetchHandler,
    error: DevErrorHandler,
): Promise<Result<DevServerHandle>> => {
    const requestedPort = resolveDevPort(config);
    let attemptsRemaining = requestedPort === 0 ? DEV_PORT_RETRY_LIMIT : 1;

    while (attemptsRemaining > 0) {
        const nextPort = requestedPort === 0 ? createEphemeralPortCandidate() : requestedPort;

        const started = await Promise.resolve()
            .then(() =>
                ok(
                    createServerHandle(
                        Bun.serve({
                            error: ((serverError) => error(serverError)) as BunServeOptions["error"],
                            fetch: ((req) => fetch(req)) as BunServeOptions["fetch"],
                            port: nextPort,
                        } as BunServeOptions),
                    ),
                ),
            )
            .catch((startError: unknown) => {
                const errorCode = getErrorCode(startError);
                const errorMessage = getErrorMessage(startError);
                return fail(
                    errorCode === undefined
                        ? `Failed to start dev server: ${errorMessage}`
                        : `Failed to start dev server: ${errorCode}: ${errorMessage}`,
                );
            });
        if (started.ok) {
            return started;
        }

        attemptsRemaining -= 1;
        if (requestedPort !== 0 || !started.error.includes("EADDRINUSE") || attemptsRemaining === 0) {
            return started;
        }
    }

    return fail("Failed to start dev server.");
};

export const runConfiguredDevServer = async (cwd = process.cwd()): Promise<Result<DevServerHandle>> => {
    const config = await loadSvelteConfig(cwd);
    if (!config.ok) {
        return config;
    }

    const rootDir = config.value.rootDir ?? cwd;
    const initialState = await deriveDevRuntimeState(config.value, rootDir);
    if (!initialState.ok) {
        return initialState;
    }
    let currentState = initialState.value;

    const nodeModulesRoot = await findNodeModulesRoot(rootDir);
    if (!nodeModulesRoot.ok) {
        return nodeModulesRoot;
    }

    const importMap = createImportMap();
    const compileCache = createDevCompileCache();
    let reloadHub: DevReloadHub<DevCompileCache>;
    const reloadConfig = async (): Promise<void> => {
        const nextConfig = await loadSvelteConfig(rootDir);
        if (!nextConfig.ok) {
            console.error(nextConfig.error);
            return;
        }

        const nextState = await deriveDevRuntimeState(nextConfig.value, rootDir);
        if (!nextState.ok) {
            console.error(nextState.error);
            return;
        }

        currentState = nextState.value;
        reloadHub.reconfigure(nextState.value.watchRoots);
        reloadHub.emit("reload");
    };
    reloadHub = createDevReloadHub(
        rootDir,
        currentState.watchRoots,
        compileCache,
        (modulePath, allowedRoots) => compileChangedDevAsset(rootDir, modulePath, compileCache, allowedRoots),
        reloadConfig,
    );

    const started = await startServer(
        config.value,
        async (req: Request) => {
            const url = new URL(req.url);
            const rawPathname = getRawRequestPathname(req.url);

            if (req.method !== "GET" && req.method !== "HEAD") {
                return createMethodNotAllowedResponse();
            }

            if (url.pathname === "/") {
                const importMapScript = `<script type="importmap">${JSON.stringify(importMap)}</script>`;
                return new Response(createDevHtmlShell(importMapScript, currentState.mountId, currentState.appTitle), {
                    headers: { "Content-Type": "text/html" },
                });
            }

            if (url.pathname === "/main.ts") {
                return new Response(
                    createBootstrapSource(createImportPath(rootDir, currentState.appComponentPath), currentState.mountId),
                    {
                        headers: { "Content-Type": "application/javascript" },
                    },
                );
            }

            if (url.pathname === DEV_LIVE_RELOAD_PATH) {
                return createSSEResponse(reloadHub, req.signal);
            }

            if (url.pathname === "/_virtual/esm-env.js") {
                return new Response("export const BROWSER = true; export const DEV = true; export const NODE = false;", {
                    headers: { "Content-Type": "application/javascript" },
                });
            }

            const staticAssetRequest = resolveDevStaticAssetRequest(currentState.assetsDirs, url.pathname);
            if (staticAssetRequest) {
                const resolvedAssetPath = await resolvePhysicalAssetPath(
                    staticAssetRequest.physicalRoot,
                    staticAssetRequest.requestedPath,
                );
                if (!resolvedAssetPath.ok) {
                    return new Response("Not Found", { status: 404 });
                }

                const assetFile = Bun.file(resolvedAssetPath.value);
                if (!statSync(resolvedAssetPath.value).isFile()) {
                    return new Response("Not Found", { status: 404 });
                }

                return new Response(assetFile);
            }

            if (rawPathname.startsWith("/_node_modules/")) {
                const resolvedNodeModulePath = await resolveDevNodeModuleRequestPath(nodeModulesRoot.value, rawPathname);
                if (!resolvedNodeModulePath.ok) {
                    return new Response("Not Found", { status: 404 });
                }

                if (isCompilableDevModule(resolvedNodeModulePath.value.modulePath)) {
                    const compiled = await loadDevModule(
                        resolvedNodeModulePath.value.packageRoot,
                        resolvedNodeModulePath.value.modulePath,
                        reloadHub.cache,
                    );
                    if (!compiled.ok) {
                        return createDevModuleErrorResponse(compiled.error);
                    }

                    return new Response(compiled.value, {
                        headers: { "Content-Type": "application/javascript" },
                    });
                }

                const nodeModuleFile = Bun.file(resolvedNodeModulePath.value.filePath);
                if (!(await nodeModuleFile.exists())) {
                    return new Response("Not Found", { status: 404 });
                }

                return new Response(nodeModuleFile);
            }

            if (isSupportedTypeScriptSourceModule(rawPathname)) {
                const resolvedSourcePath = await resolveDevRequestPath(rootDir, rawPathname, "/");
                if (!resolvedSourcePath.ok) {
                    return new Response("Not Found", { status: 404 });
                }

                if (!isPathInsideRoot(currentState.sourceRoot, resolvedSourcePath.value.resolvedPath)) {
                    return new Response("Not Found", { status: 404 });
                }

                const allowedSourceRoots = [realpathSync(currentState.sourceRoot)];
                const transpiled = await loadDevModule(
                    rootDir,
                    resolvedSourcePath.value.modulePath,
                    reloadHub.cache,
                    allowedSourceRoots,
                );
                if (!transpiled.ok) {
                    return createDevModuleErrorResponse(transpiled.error);
                }

                return new Response(transpiled.value, {
                    headers: { "Content-Type": "application/javascript" },
                });
            }

            if (isSupportedJavaScriptSourceModule(rawPathname)) {
                const resolvedSourcePath = await resolveDevRequestPath(rootDir, rawPathname, "/");
                if (!resolvedSourcePath.ok) {
                    return new Response("Not Found", { status: 404 });
                }

                if (!isPathInsideRoot(currentState.sourceRoot, resolvedSourcePath.value.resolvedPath)) {
                    return new Response("Not Found", { status: 404 });
                }

                const allowedSourceRoots = [realpathSync(currentState.sourceRoot)];
                const source = await loadDevModule(
                    rootDir,
                    resolvedSourcePath.value.modulePath,
                    reloadHub.cache,
                    allowedSourceRoots,
                );
                if (!source.ok) {
                    return createDevModuleErrorResponse(source.error);
                }

                return new Response(source.value, {
                    headers: { "Content-Type": "application/javascript" },
                });
            }

            if (isSupportedSvelteSourceModule(rawPathname)) {
                const resolvedSourcePath = await resolveDevRequestPath(rootDir, rawPathname, "/");
                if (!resolvedSourcePath.ok) {
                    return new Response("Not Found", { status: 404 });
                }

                if (!isPathInsideRoot(currentState.sourceRoot, resolvedSourcePath.value.resolvedPath)) {
                    return new Response("Not Found", { status: 404 });
                }

                const compiled = await loadDevModule(rootDir, resolvedSourcePath.value.modulePath, reloadHub.cache, [
                    realpathSync(currentState.sourceRoot),
                ]);
                if (!compiled.ok) {
                    return createDevModuleErrorResponse(compiled.error);
                }

                return new Response(compiled.value, {
                    headers: { "Content-Type": "application/javascript" },
                });
            }

            if (shouldServeDevAppShell(req.method, url.pathname, currentState.sourcePathPrefix)) {
                const importMapScript = `<script type="importmap">${JSON.stringify(importMap)}</script>`;
                return new Response(createDevHtmlShell(importMapScript, currentState.mountId, currentState.appTitle), {
                    headers: { "Content-Type": "text/html" },
                });
            }

            return new Response("Not Found", { status: 404 });
        },
        (error: ErrorLike) => {
            console.error(error);
            return createInternalServerErrorResponse();
        },
    );

    if (!started.ok) {
        reloadHub.stop();
        return started;
    }

    return ok({
        port: started.value.port,
        stop: async () => {
            reloadHub.stop();
            await started.value.stop();
        },
    });
};

export const runDevCli = async ({
    cwd = process.cwd(),
    error = console.error,
    log = console.log,
    run = runConfiguredDevServer,
}: DevCliDependencies = {}): Promise<number> => {
    const result = await run(cwd);
    if (!result.ok) {
        error(result.error);
        return 1;
    }

    log(`Serving http://localhost:${result.value.port}`);
    return 0;
};

if (import.meta.main) {
    const exitCode = await runDevCli();
    if (exitCode !== 0) {
        process.exit(exitCode);
    }
}
