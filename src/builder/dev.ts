#!/usr/bin/env bun

import { randomInt } from "node:crypto";

import { existsSync, lstatSync, readdirSync, realpathSync, statSync, watch, type FSWatcher } from "node:fs";

import { dirname, isAbsolute, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { gzipSync } from "node:zlib";
import { compile, compileModule } from "svelte/compiler";
import type { ErrorLike, Server } from "bun";

import {
    createBootstrapSource,
    createImportPath,
    escapeHtml,
    isSupportedJavaScriptSourceModule,
    isSupportedLocalSourceModule,
    isSupportedSvelteRunesSourceModule,
    isSupportedSvelteSourceModule,
    isSupportedTypeScriptSourceModule,
    validateLocalSourceImportGraph,
    validateSvelteBrowserImportAliases,
} from "./build-internals";

import { ok, err, getErrorMessage, getErrorCode, normalizeModulePath, resolveConfiguredPath, type Result } from "./utils";
import {
    loadSvelteConfig,
    resolveAppSourceRoot,
    validateResolvedAppComponentPath,
    type BuildSvelteOptions,
} from "./config";

import { resolveConfiguredAssetsDirs, resolvePhysicalAssetPath, type ResolvedAssetsDir } from "./assets";
import { formatAssetReport } from "./report";

// ---- Types ----

type DevCompileCacheEntry = {
    contents: string;
    mtimeMs: number;
};

type DevCompileCache = {
    invalidate: (cacheKey: string) => void;
    read: (cacheKey: string, mtimeMs: number) => string | undefined;
    write: (cacheKey: string, mtimeMs: number, contents: string) => void;
};

// ---- Logging ----

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

// ---- Cache ----

const createDevCompileCache = (): DevCompileCache => {
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

const createDevCompileCacheKey = (rootDir: string, modulePath: string): string =>
    normalizeModulePath(join(rootDir, modulePath));

// ---- File reading ----

const loadRequiredText = async (path: string): Promise<Result<string>> => {
    const file = Bun.file(path);
    const exists = await file.exists();
    if (!exists) {
        return err(`Missing file: ${path}`);
    }

    return file.text().then(
        (value) => ok(value),
        (error) => err(`Failed to read ${path}: ${getErrorMessage(error)}`),
    );
};

// ---- CSS injection ----

const createCssInjection = (modulePath: string, cssCode: string | undefined): string => {
    if (!cssCode) {
        return "";
    }

    return [
        "(() => {",
        `    const id = ${JSON.stringify(modulePath)};`,
        `    if (!document.querySelector(\`style[data-svelte-id="\${id}"]\`)) {`,
        `        const style = document.createElement("style");`,
        `        style.setAttribute("data-svelte-id", id);`,
        `        style.textContent = ${JSON.stringify(cssCode)};`,
        `        document.head.appendChild(style);`,
        "    }",
        "})();",
    ].join("\n");
};

// ---- Compilation ----

const tsTranspiler = new Bun.Transpiler({ loader: "ts" });

const prepareSvelteRunesSourceForDev = (modulePath: string, source: string): string => {
    if (!modulePath.endsWith(".svelte.ts")) return source;
    return tsTranspiler.transformSync(source);
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
                return rewriteBareImportsForDev(contents, join(rootDir, modulePath)).then((rewritten: Result<string>) => {
                    if (!rewritten.ok) {
                        return rewritten;
                    }

                    if (shouldLog) {
                        logRecompiledAsset(modulePath, rewritten.value);
                    }

                    return ok(rewritten.value);
                });
            },
            (error) => err(`Failed to compile ${modulePath}: ${getErrorMessage(error)}`),
        );
};

const transpileTypeScriptForDev = async (
    rootDir: string,
    modulePath: string,
    shouldLog = false,
): Promise<Result<string>> => {
    const source = await loadRequiredText(join(rootDir, modulePath));
    if (!source.ok) {
        return source;
    }

    return Promise.resolve()
        .then(() => {
            const transformed = tsTranspiler.transformSync(source.value);
            return rewriteBareImportsForDev(transformed, join(rootDir, modulePath)).then((rewritten: Result<string>) => {
                if (!rewritten.ok) {
                    return rewritten;
                }

                if (shouldLog) {
                    logRecompiledAsset(modulePath, rewritten.value);
                }

                return ok(rewritten.value);
            });
        })
        .catch((error: unknown) => err(`Failed to transpile ${modulePath}: ${getErrorMessage(error)}`));
};

const compileSvelteRunesForDev = async (
    rootDir: string,
    modulePath: string,
    shouldLog = false,
): Promise<Result<string>> => {
    const source = await loadRequiredText(join(rootDir, modulePath));
    if (!source.ok) {
        return source;
    }

    return Promise.resolve()
        .then(() => {
            const compiled = compileModule(prepareSvelteRunesSourceForDev(modulePath, source.value), {
                filename: modulePath,
            });
            return rewriteBareImportsForDev(compiled.js.code, join(rootDir, modulePath)).then((rewritten: Result<string>) => {
                if (!rewritten.ok) {
                    return rewritten;
                }

                if (shouldLog) {
                    logRecompiledAsset(modulePath, rewritten.value);
                }

                return ok(rewritten.value);
            });
        })
        .catch((error: unknown) => err(`Failed to compile ${modulePath}: ${getErrorMessage(error)}`));
};

// ---- Module loading ----

const isCompilableDevModule = (filePath: string): boolean => isSupportedLocalSourceModule(filePath);

const getDevModuleMtime = (rootDir: string, modulePath: string): Result<number> => {
    try {
        return ok(statSync(join(rootDir, modulePath)).mtimeMs);
    } catch (error) {
        return err(`Missing file: ${join(rootDir, modulePath)} (${getErrorMessage(error)})`);
    }
};

const loadUncachedDevModule = async (rootDir: string, modulePath: string, shouldLog = false): Promise<Result<string>> => {
    if (isSupportedSvelteSourceModule(modulePath)) {
        return compileSvelteForDev(rootDir, modulePath, shouldLog);
    }

    if (isSupportedSvelteRunesSourceModule(modulePath)) {
        return compileSvelteRunesForDev(rootDir, modulePath, shouldLog);
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

    return err(`Unsupported dev module: ${modulePath}`);
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

// ---- Error responses ----

const createInternalServerErrorResponse = (): Response => new Response("Internal Server Error", { status: 500 });

const createNotFoundResponse = (): Response => new Response("Not Found", { status: 404 });

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
        return err("Rejected path");
    }

    const segments: string[] = [];
    for (const segment of decodedPath.replace(/\\/g, "/").split("/")) {
        if (segment.length === 0 || segment === ".") {
            continue;
        }

        if (segment === "..") {
            return err("Rejected path");
        }

        segments.push(segment);
    }

    if (segments.length === 0) {
        return err("Rejected path");
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
                return err("Rejected path");
            }

            return ok({ filePath, modulePath, resolvedPath: realFilePath });
        } catch {
            return err("Rejected path");
        }
    }

    if (!(await Bun.file(filePath).exists())) {
        return ok({ filePath, modulePath, resolvedPath: filePath });
    }

    const realRootDir = realpathSync(rootDir);
    const realFilePath = realpathSync(filePath);
    if (!isPathInsideRoot(realRootDir, realFilePath)) {
        return err("Rejected path");
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
        return err("Rejected path");
    }

    const segments: string[] = [];
    for (const segment of decodedPath.replace(/\\/g, "/").split("/")) {
        if (segment.length === 0 || segment === ".") {
            continue;
        }

        if (segment === "..") {
            return err("Rejected path");
        }

        segments.push(segment);
    }

    const packageNameSegments = getNodeModulePackageNameSegments(segments);
    if (packageNameSegments.length === 0 || segments.length <= packageNameSegments.length) {
        return err("Rejected path");
    }

    const packagePath = join(nodeModulesRoot, ...packageNameSegments);
    let packageRoot: string;
    try {
        packageRoot = dirname(realpathSync(join(packagePath, "package.json")));
    } catch {
        return err("Rejected path");
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
        return err("Rejected path");
    }

    if (!isPathInsideRoot(packageRoot, resolvedPath)) {
        return err("Rejected path");
    }

    return ok({ filePath, modulePath, packageRoot, resolvedPath });
};

const findNodeModulesRoot = async (startDir: string): Promise<Result<string>> => {
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
            return fallback === undefined ? err(`Unable to locate node_modules from ${startDir}`) : ok(fallback);
        }

        current = parent;
    }
};

type DevWatchRoot = {
    path: string;
    recursive: boolean;
};

type DevWatchTarget =
    { kind: "config" } | { kind: "directory"; path: string } | { kind: "ignore" } | { kind: "module"; modulePath: string };

type DevReloadHub<TCache> = {
    cache: TCache;
    emit: (data: string) => void;
    reconfigure: (watchRoots: DevWatchRoot[]) => void;
    stop: () => void;
    subscribe: (listener: (data: string) => void) => () => void;
};

const DEV_CONFIG_FILE_NAME = "builder.ts";
const DEV_WATCH_DEBOUNCE_MS = 100;
const EXCLUDED_DIRS = ["node_modules", ".git", "dist"];

const isExcludedWatchDirectory = (dirName: string): boolean => EXCLUDED_DIRS.includes(dirName);

const getWatcherErrorCode = (error: unknown): string | undefined =>
    typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" ? error.code : undefined;

const isIgnorableDevWatcherError = (error: unknown): boolean => {
    const errorCode = getWatcherErrorCode(error);
    return errorCode === "ENOENT" || errorCode === "ENOTDIR";
};

const classifyDevWatchTarget = ({
    eventPath,
    fileStatus,
    filename,
    watchDir,
}: {
    eventPath: string;
    fileStatus: "directory" | "file" | "missing" | "other";
    filename: string;
    watchDir: string;
}): DevWatchTarget => {
    const relativePath = relative(watchDir, eventPath);
    if (relativePath.startsWith("..") || relativePath.length === 0) {
        return { kind: "ignore" };
    }

    if (relativePath === DEV_CONFIG_FILE_NAME) {
        return { kind: "config" };
    }

    if (fileStatus === "directory") {
        if (!isExcludedWatchDirectory(filename) && !filename.startsWith(".")) {
            return { kind: "directory", path: eventPath };
        }

        return { kind: "ignore" };
    }

    if (fileStatus === "file" || fileStatus === "missing") {
        return isCompilableDevModule(relativePath) ? { kind: "module", modulePath: relativePath } : { kind: "ignore" };
    }

    return { kind: "ignore" };
};

const formatDevWatcherIssue = (context: string, error: unknown): string | undefined => {
    if (isIgnorableDevWatcherError(error)) {
        return undefined;
    }

    return `[svelte-dev] ${context}: ${getErrorMessage(error)}`;
};

const reportDevWatcherIssue = (context: string, error: unknown): void => {
    const issue = formatDevWatcherIssue(context, error);
    if (issue !== undefined) {
        console.warn(issue);
    }
};

const attachDevWatcherErrorHandler = (
    watcher: { on: (event: string, handler: (error: unknown) => void) => unknown },
    context: string,
): void => {
    watcher.on("error", (error) => {
        reportDevWatcherIssue(context, error);
    });
};

const shouldProcessDevWatchEvent = (
    recentEvents: Map<string, number>,
    modulePath: string,
    now = Date.now(),
): boolean => {
    const previous = recentEvents.get(modulePath);
    recentEvents.set(modulePath, now);

    if (previous !== undefined && now - previous < DEV_WATCH_DEBOUNCE_MS) {
        return false;
    }

    for (const [path, timestamp] of recentEvents) {
        if (now - timestamp >= DEV_WATCH_DEBOUNCE_MS) {
            recentEvents.delete(path);
        }
    }

    return true;
};

const createDevReloadHub = <TCache>(
    watchDir: string,
    watchRoots: DevWatchRoot[],
    cache: TCache,
    compileChangedModule: (modulePath: string, allowedRoots: string[]) => Promise<void>,
    onConfigFileChange?: () => void | Promise<void>,
): DevReloadHub<TCache> => {
    const watchers: { close: () => void }[] = [];
    const listeners = new Set<(data: string) => void>();
    const recentEvents = new Map<string, number>();
    const watchedDirs = new Set<string>();
    let recursiveWatchRoots = new Set(watchRoots.filter((root) => root.recursive).map((root) => root.path));
    let allowedRoots = Array.from(
        new Set(
            watchRoots
                .filter((root) => root.recursive)
                .map((root) => {
                    try {
                        return realpathSync(root.path);
                    } catch {
                        return root.path;
                    }
                }),
        ),
    );

    const stopWatchers = (): void => {
        watchers.forEach((watcher) => watcher.close());
        watchers.length = 0;
        watchedDirs.clear();
    };

    const stop = (): void => {
        stopWatchers();
        listeners.clear();
    };

    const notify = (data: string): void => {
        for (const listener of listeners) {
            listener(data);
        }
    };

    const isWatchableDirectory = (path: string): boolean => {
        const entry = lstatSync(path);
        return entry.isDirectory() && !entry.isSymbolicLink();
    };

    const getFileStatus = (modulePath: string): "directory" | "file" | "missing" | "other" => {
        try {
            const entry = lstatSync(modulePath);
            if (entry.isDirectory()) return "directory";
            if (entry.isFile()) return "file";
            return "other";
        } catch (error) {
            return isIgnorableDevWatcherError(error)
                ? "missing"
                : (() => {
                      throw error;
                  })();
        }
    };

    const handleWatchEvent = (dir: string, filename: string, recursive: boolean) => {
        const modulePath = join(dir, filename);
        const fileStatus = getFileStatus(modulePath);
        const target = classifyDevWatchTarget({ eventPath: modulePath, fileStatus, filename, watchDir: dir });

        if (target.kind === "config") {
            void Promise.resolve(onConfigFileChange?.()).catch((error: unknown) => {
                console.error(getErrorMessage(error));
            });
            return;
        }

        if (target.kind === "directory") {
            if (recursive || recursiveWatchRoots.has(target.path)) {
                watchDirectory(target.path, true);
            }
            return;
        }

        if (target.kind !== "module") return;

        if (!shouldProcessDevWatchEvent(recentEvents, target.modulePath)) return;

        notify("reload");
        void compileChangedModule(target.modulePath, allowedRoots);
    };

    const watchDirectory = (dir: string, recursive: boolean) => {
        if (watchedDirs.has(dir)) return;

        watchedDirs.add(dir);
        try {
            const watcher = watch(dir, (_eventType: unknown, filename: string | null) => {
                if (typeof filename !== "string" || filename.length === 0) {
                    notify("reload");
                    return;
                }

                try {
                    handleWatchEvent(dir, filename, recursive);
                } catch (error) {
                    reportDevWatcherIssue(`watch event for ${join(dir, filename)}`, error);
                }
            });
            attachDevWatcherErrorHandler(watcher, `watch runtime for ${dir}`);
            watchers.push(watcher);

            if (recursive) {
                for (const file of readdirSync(dir)) {
                    const fullPath = join(dir, file);
                    if (isWatchableDirectory(fullPath) && !isExcludedWatchDirectory(file) && !file.startsWith(".")) {
                        watchDirectory(fullPath, true);
                    }
                }
            }
        } catch (error) {
            watchedDirs.delete(dir);
            reportDevWatcherIssue(`watch setup for ${dir}`, error);
        }
    };

    const reconfigure = (nextWatchRoots: DevWatchRoot[]): void => {
        stopWatchers();
        recentEvents.clear();

        recursiveWatchRoots = new Set(nextWatchRoots.filter((root) => root.recursive).map((root) => root.path));
        allowedRoots = Array.from(
            new Set(
                nextWatchRoots
                    .filter((root) => root.recursive)
                    .map((root) => {
                        try {
                            return realpathSync(root.path);
                        } catch {
                            return root.path;
                        }
                    }),
            ),
        );

        nextWatchRoots.forEach((root) => watchDirectory(root.path, root.recursive));
    };

    reconfigure(watchRoots);

    return {
        cache,
        emit: notify,
        reconfigure,
        stop,
        subscribe: (listener) => {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
    };
};

const createSSEResponse = <TCache>(hub: DevReloadHub<TCache>, signal: AbortSignal): Response => {
    const listeners: Array<() => void> = [];

    const stream = new ReadableStream({
        start: (controller) => {
            const send = (data: string) => controller.enqueue(`data: ${data}\n\n`);
            const timer = setInterval(() => controller.enqueue(":heartbeat\n\n"), 5000);

            const cleanup = () => {
                clearInterval(timer);
                listeners.forEach((unsubscribe) => unsubscribe());
                try {
                    if (controller.desiredSize !== null) {
                        controller.close();
                    }
                } catch {}
            };

            signal.addEventListener("abort", cleanup);
            listeners.push(hub.subscribe((data) => send(data)));
        },
    });

    return new Response(stream, {
        headers: {
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            "Content-Type": "text/event-stream",
        },
    });
};

const resolveDevStaticAssetRequest = (
    assetsDirs: ResolvedAssetsDir[],
    pathname: string,
): { physicalRoot: string; requestedPath: string } | null => {
    const segments = pathname.split("/").filter((segment) => segment.length > 0);
    const [dirName, ...pathSegments] = segments;
    if (!dirName || pathSegments.length === 0) {
        return null;
    }

    const matchingAssetsDir = assetsDirs.find((entry) => entry.dirName === dirName);
    if (!matchingAssetsDir) {
        return null;
    }

    return {
        physicalRoot: matchingAssetsDir.physicalPath,
        requestedPath: pathSegments.join("/"),
    };
};

type DevRuntimeState = {
    appComponentPath: string;
    appTitle: string;
    assetsDirs: ResolvedAssetsDir[];
    mountId: string;
    sourcePathPrefix: string | undefined;
    sourceRoot: string;
    watchRoots: DevWatchRoot[];
};

const createSourcePathPrefix = (rootDir: string, sourceRoot: string): string | undefined => {
    const relativeSourceRoot = normalizeModulePath(relative(rootDir, sourceRoot));
    if (relativeSourceRoot.length === 0 || relativeSourceRoot === ".") {
        return undefined;
    }

    return `/${relativeSourceRoot}/`;
};

const resolveDevSourceRoot = (rootDir: string, appComponentPath: string): string => {
    const relativeAppComponentPath = relative(rootDir, appComponentPath);
    const segments = relativeAppComponentPath.split(/[\\/]/).filter((segment) => segment.length > 0);
    const [topLevelDir] = segments;

    if (topLevelDir === undefined || segments.length <= 1) {
        return dirname(appComponentPath);
    }

    return topLevelDir === "src" ? join(rootDir, "src") : join(rootDir, topLevelDir);
};

const resolveDevWatchRoots = (
    rootDir: string,
    assetsDirs: ResolvedAssetsDir[],
    appComponentPath: string,
): DevWatchRoot[] => {
    const sourceRoot = resolveDevSourceRoot(rootDir, appComponentPath);
    const roots = new Map<string, DevWatchRoot>();
    const addRoot = (path: string, recursive: boolean) => {
        const existing = roots.get(path);
        if (existing !== undefined) {
            roots.set(path, { path, recursive: existing.recursive || recursive });
            return;
        }

        roots.set(path, { path, recursive });
    };

    addRoot(rootDir, false);
    addRoot(sourceRoot, true);
    assetsDirs.forEach((assetsDir) => addRoot(assetsDir.physicalPath, true));

    return Array.from(roots.values()).sort(
        (left, right) => Number(left.recursive) - Number(right.recursive) || left.path.localeCompare(right.path),
    );
};

const deriveDevRuntimeState = async (
    config: BuildSvelteOptions,
    cwd = process.cwd(),
): Promise<Result<DevRuntimeState>> => {
    const rootDir = config.rootDir ?? cwd;
    const mountId = config.mountId ?? "app";
    const appTitle = config.appTitle ?? "Svelte Builder";
    const appComponentPath = resolveConfiguredPath(rootDir, config.appComponent, "src/App.svelte");
    const sourceRoot = resolveAppSourceRoot(rootDir, appComponentPath, "builder.ts");
    if (!sourceRoot.ok) {
        return sourceRoot;
    }

    const appComponentExists = await Bun.file(appComponentPath).exists();
    if (!appComponentExists) {
        return err(`Missing SPA app component: ${appComponentPath}`);
    }

    const validatedAppComponentPath = validateResolvedAppComponentPath(rootDir, sourceRoot.value, appComponentPath, "builder.ts");
    if (!validatedAppComponentPath.ok) {
        return validatedAppComponentPath;
    }

    const validatedImportGraph = await validateLocalSourceImportGraph(appComponentPath, [realpathSync(sourceRoot.value)]);
    if (!validatedImportGraph.ok) {
        return validatedImportGraph;
    }

    const validatedRuntimeAliases = await validateSvelteBrowserImportAliases(rootDir);
    if (!validatedRuntimeAliases.ok) {
        return validatedRuntimeAliases;
    }

    const assetsDirs = await resolveConfiguredAssetsDirs(rootDir, config.assetsDirs, "assets");
    if (!assetsDirs.ok) {
        return assetsDirs;
    }

    return ok({
        appComponentPath,
        appTitle,
        assetsDirs: assetsDirs.value,
        mountId,
        sourcePathPrefix: createSourcePathPrefix(rootDir, sourceRoot.value),
        sourceRoot: sourceRoot.value,
        watchRoots: resolveDevWatchRoots(rootDir, assetsDirs.value, appComponentPath),
    });
};

export const DEV_SPECIAL_IMPORTS = {
    "esm-env": "/_virtual/esm-env.js",
    svelte: "/_node_modules/svelte/src/index-client.js",
    "svelte/internal": "/_node_modules/svelte/src/internal/index.js",
    "svelte/internal/client": "/_node_modules/svelte/src/internal/client/index.js",
    "svelte/internal/disclose-version": "/_node_modules/svelte/src/internal/disclose-version.js",
} as const;

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toRelativeImportSpecifier = (importerPath: string, resolvedPath: string): string => {
    const relativePath = normalizeModulePath(relative(dirname(importerPath), resolvedPath));
    return relativePath.startsWith(".") ? relativePath : `./${relativePath}`;
};

const isBareImportSpecifier = (specifier: string): boolean =>
    !specifier.startsWith(".") &&
    !specifier.startsWith("/") &&
    !specifier.startsWith("data:") &&
    !specifier.startsWith("blob:") &&
    !specifier.startsWith("http:") &&
    !specifier.startsWith("https:");

const isPackageImportSpecifier = (specifier: string): boolean => specifier.startsWith("#");

const isNodeModulesPackageRoot = (packageRoot: string): boolean =>
    normalizeModulePath(packageRoot).split("/").includes("node_modules");

const getPackageNameFromSpecifier = (specifier: string): string => {
    const segments = specifier.split("/");
    if (segments[0]?.startsWith("@")) {
        return segments.slice(0, 2).join("/");
    }

    return segments[0] ?? "";
};

const resolveImporterPackageForDev = async (
    importerPath: string,
): Promise<Result<{ packageName: string; packageRoot: string }>> => {
    let currentDir = dirname(importerPath);

    while (true) {
        const packageJsonPath = join(currentDir, "package.json");
        const packageJsonFile = Bun.file(packageJsonPath);

        if (await packageJsonFile.exists()) {
            let packageJson: unknown;
            try {
                packageJson = await packageJsonFile.json();
            } catch (error) {
                return err(`Failed to read ${packageJsonPath}: ${getErrorMessage(error)}`);
            }

            const packageName =
                typeof packageJson === "object" && packageJson !== null && "name" in packageJson ? packageJson.name : undefined;
            if (typeof packageName !== "string" || packageName.length === 0) {
                return err(`Missing package name in ${packageJsonPath}`);
            }

            return ok({ packageName, packageRoot: currentDir });
        }

        const parentDir = dirname(currentDir);
        if (parentDir === currentDir) {
            return err(`Failed to resolve package root for ${importerPath}`);
        }

        currentDir = parentDir;
    }
};

const replaceImportSpecifier = (source: string, specifier: string, replacement: string): string => {
    const escapedSpecifier = escapeRegExp(specifier);
    const dynamicImportPattern = new RegExp(`\\bimport\\s*\\(\\s*(['"])${escapedSpecifier}\\1\\s*\\)`, "g");
    const importFromPattern = new RegExp(`\\bfrom\\s+(['"])${escapedSpecifier}\\1`, "g");
    const sideEffectImportPattern = new RegExp(`\\bimport\\s+(['"])${escapedSpecifier}\\1`, "g");

    return source
        .replace(dynamicImportPattern, (_, quote: string) => `import(${quote}${replacement}${quote})`)
        .replace(importFromPattern, (_, quote: string) => `from ${quote}${replacement}${quote}`)
        .replace(sideEffectImportPattern, (_, quote: string) => `import ${quote}${replacement}${quote}`);
};

const resolveBareImportPathForDev = async (specifier: string, importerPath: string): Promise<Result<string>> => {
    const specialImport = DEV_SPECIAL_IMPORTS[specifier as keyof typeof DEV_SPECIAL_IMPORTS];
    if (specialImport !== undefined) {
        return ok(specialImport);
    }

    if (!isBareImportSpecifier(specifier)) {
        return ok(specifier);
    }

    const packageName = getPackageNameFromSpecifier(specifier);
    if (packageName.length === 0) {
        return err(`Unsupported bare import in ${importerPath}: ${specifier}`);
    }

    const importerUrl = pathToFileURL(importerPath).href;

    if (isPackageImportSpecifier(specifier)) {
        const importerPackage = await resolveImporterPackageForDev(importerPath);
        if (!importerPackage.ok) {
            return importerPackage;
        }

        if (!isNodeModulesPackageRoot(importerPackage.value.packageRoot)) {
            return err(`App-local package imports are not supported in dev: ${specifier} from ${importerPath}`);
        }

        return Promise.resolve()
            .then(() => import.meta.resolve(specifier, importerUrl))
            .then(
                (resolvedUrl) => {
                    if (!resolvedUrl.startsWith("file://")) {
                        return err(`Unsupported resolved import for ${specifier}: ${resolvedUrl}`);
                    }

                    const resolvedPath = fileURLToPath(resolvedUrl);
                    const relativePath = relative(importerPackage.value.packageRoot, resolvedPath);
                    if (relativePath.length === 0 || relativePath.startsWith("..") || isAbsolute(relativePath)) {
                        return err(`Resolved import escaped package root for ${specifier}: ${resolvedPath}`);
                    }

                    if (!isNodeModulesPackageRoot(importerPackage.value.packageRoot)) {
                        return ok(toRelativeImportSpecifier(importerPath, resolvedPath));
                    }

                    return ok(
                        `/_node_modules/${normalizeModulePath(importerPackage.value.packageName)}/${normalizeModulePath(relativePath)}`,
                    );
                },
                (error) => err(`Failed to resolve ${specifier} from ${importerPath}: ${getErrorMessage(error)}`),
            );
    }

    return Promise.all([
        import.meta.resolve(specifier, importerUrl),
        import.meta.resolve(`${packageName}/package.json`, importerUrl),
    ]).then(
        ([resolvedUrl, packageJsonUrl]) => {
            if (!resolvedUrl.startsWith("file://") || !packageJsonUrl.startsWith("file://")) {
                return err(`Unsupported resolved import for ${specifier}: ${resolvedUrl}`);
            }

            const resolvedPath = fileURLToPath(resolvedUrl);
            const packageRoot = dirname(fileURLToPath(packageJsonUrl));
            const relativePath = relative(packageRoot, resolvedPath);
            if (relativePath.length === 0 || relativePath.startsWith("..") || isAbsolute(relativePath)) {
                return err(`Resolved import escaped package root for ${specifier}: ${resolvedPath}`);
            }

            return ok(`/_node_modules/${normalizeModulePath(packageName)}/${normalizeModulePath(relativePath)}`);
        },
        (error) => err(`Failed to resolve ${specifier} from ${importerPath}: ${getErrorMessage(error)}`),
    );
};

const jsImportScanner = new Bun.Transpiler({ loader: "js" });

const rewriteBareImportsForDev = async (source: string, importerPath: string): Promise<Result<string>> => {
    const specifiers = Array.from(
        new Set(
            jsImportScanner
                .scanImports(source)
                .map((record) => record.path)
                .filter(
                    (specifier) =>
                        DEV_SPECIAL_IMPORTS[specifier as keyof typeof DEV_SPECIAL_IMPORTS] !== undefined ||
                        isBareImportSpecifier(specifier),
                ),
        ),
    );

    let rewritten = source;

    for (const specifier of specifiers) {
        const resolved = await resolveBareImportPathForDev(specifier, importerPath);
        if (!resolved.ok) {
            return resolved;
        }

        rewritten = replaceImportSpecifier(rewritten, specifier, resolved.value);
    }

    return ok(rewritten);
};

export type DevServerHandle = {
    port: number;
    stop: () => Promise<void>;
};

export type DevCliDependencies = {
    cwd?: string;
    error?: (message: string) => void;
    log?: (message: string) => void;
    run?: (cwd: string) => Promise<Result<DevServerHandle>>;
};

const DEV_PORT_RETRY_LIMIT = 8;
const DEV_PORT_RANGE_MAX = 65535;
const DEV_PORT_RANGE_MIN = 49152;

const createMethodNotAllowedResponse = (): Response =>
    new Response("Method Not Allowed", {
        status: 405,
        headers: { Allow: "GET, HEAD" },
    });
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
        `    <main id="${escapeHtml(mountId)}"></main>`,
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

const createImportMap = () => ({
    imports: DEV_SPECIAL_IMPORTS,
});

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
                            idleTimeout: 20,
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
                return err(
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

    return err("Failed to start dev server.");
};

const runConfiguredDevServer = async (cwd = process.cwd()): Promise<Result<DevServerHandle>> => {
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

    const handleSourceModuleRequest = async (
        rawPathname: string,
        rootDir: string,
        sourceRoot: string,
        cache: DevCompileCache,
    ): Promise<Response | null> => {
        const resolvedSourcePath = await resolveDevRequestPath(rootDir, rawPathname, "/");
        if (!resolvedSourcePath.ok) {
            return null;
        }

        if (!isPathInsideRoot(sourceRoot, resolvedSourcePath.value.resolvedPath)) {
            return null;
        }

        const allowedRoots = [realpathSync(sourceRoot)];
        const source = await loadDevModule(rootDir, resolvedSourcePath.value.modulePath, cache, allowedRoots);
        if (!source.ok) {
            return createDevModuleErrorResponse(source.error);
        }

        return new Response(source.value, {
            headers: { "Content-Type": "application/javascript" },
        });
    };

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

                const assetStat = statSync(resolvedAssetPath.value);
                if (!assetStat.isFile()) {
                    return new Response("Not Found", { status: 404 });
                }

                const fileContent = await Bun.file(resolvedAssetPath.value).arrayBuffer();
                return new Response(fileContent, {
                    headers: { "Content-Type": "application/octet-stream" },
                });
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

                const nodeModuleFile = Bun.file(resolvedNodeModulePath.value.resolvedPath);
                if (!(await nodeModuleFile.exists())) {
                    return new Response("Not Found", { status: 404 });
                }

                return new Response(nodeModuleFile);
            }

            if (isSupportedLocalSourceModule(rawPathname)) {
                const result = await handleSourceModuleRequest(rawPathname, rootDir, currentState.sourceRoot, reloadHub.cache);
                if (result !== null) return result;
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
            return new Response("Internal Server Error", { status: 500 });
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

export const serve = async ({
  cwd = process.cwd(),
}: DevCliDependencies = {}): Promise<Result<DevServerHandle>> => runConfiguredDevServer(cwd);

const runDevCli = async ({
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
