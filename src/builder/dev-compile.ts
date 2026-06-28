import { statSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { compile } from "svelte/compiler";
import { ok, fail, getErrorMessage, normalizeModulePath, type Result } from "./utils";
import { rewriteBareImportsForDev } from "./dev-imports";
import { formatAssetReport } from "./report";
import { validateLocalSourceImportGraph } from "./build";
import {
    isSupportedJavaScriptSourceModule,
    isSupportedLocalSourceModule,
    isSupportedSvelteSourceModule,
    isSupportedTypeScriptSourceModule,
} from "./source-modules";

// ---- Types ----

type DevCompileCacheEntry = {
    contents: string;
    mtimeMs: number;
};

export type DevCompileCache = {
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

// ---- File reading ----

export const loadRequiredText = async (path: string): Promise<Result<string>> => {
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

// ---- CSS injection ----

export const createCssInjection = (modulePath: string, cssCode: string | undefined): string => {
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

export const compileSvelteForDev = async (rootDir: string, modulePath: string, shouldLog = false): Promise<Result<string>> => {
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

export const transpileTypeScriptForDev = async (rootDir: string, modulePath: string, shouldLog = false): Promise<Result<string>> => {
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

// ---- Module loading ----

export const isCompilableDevModule = (filePath: string): boolean => isSupportedLocalSourceModule(filePath);

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

export const loadDevModule = async (
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

export const compileChangedDevAsset = async (
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

export const createDevModuleErrorResponse = (error: string): Response => {
    if (error.startsWith("Missing file:")) {
        return createNotFoundResponse();
    }

    console.error(error);
    return createInternalServerErrorResponse();
};
