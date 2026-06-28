#!/usr/bin/env bun

import { realpathSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { BuildConfig } from "bun";
import { createBootstrapSource, createImportPath } from "./bootstrap";
import {
    CONFIG_FILE_NAME,
    defineSvelteConfig,
    loadSvelteConfig,
    type BuildSvelteOptions,
    validateAppComponent,
    validateMountId,
} from "./build-config";
import { copyConfiguredAssets, resolveConfiguredAssetsDirs } from "./assets";
import {
    resolveAppSourceRoot,
    validateLocalSourceImportGraph,
    validateResolvedAppComponentPath,
    validateSvelteBrowserImportAliases,
} from "./build-validate";
import { acquirePublishLock, createBuildNonce, createStageDir, createTempOutDir, publishBuildOutput } from "./build-publish";
import { finalizeMergedCssAsset } from "./finalize-css";
import { finalizeJavaScriptAssets, type FinalJavaScriptAsset } from "./finalize-js";
import { formatBuildReport } from "./report";
import {
    createProductionEsmEnvPlugin,
    createSveltePlugin,
    createSvelteRuntimeAliasPlugin,
} from "./build-plugins";
import {
    escapeHtml,
    findUnsupportedDynamicImportExpression,
    isIdentifierCharacter,
    isLocalFileImportSpecifier,
    isPackageImportSpecifier,
    isRelativeImportSpecifier,
    skipQuotedString,
    skipWhitespaceAndComments,
} from "./import-utils";
import { ok, fail, getErrorMessage, getErrorCode, isPathWithinRoot, resolveConfiguredPath, type Result } from "./utils";

export type { Result };

export type HtmlShell = {
    appHtml: string;
    lang: string;
    title: string;
};

export type BuildArtifacts = {
    cssFile: string;
    htmlFile: string;
    jsChunkFiles?: string[];
    jsFile: string;
    outDir: string;
};

export type BuildCliDependencies = {
    cwd?: string;
    error?: (message: string) => void;
    format?: (artifacts: BuildArtifacts) => string;
    log?: (message: string) => void;
    run?: (cwd: string) => Promise<Result<BuildArtifacts>>;
};

export { defineSvelteConfig, loadSvelteConfig } from "./build-config";
export { createSveltePlugin } from "./build-plugins";
export type { BuildSvelteOptions } from "./build-config";
export {
    resolveAppSourceRoot,
    resolveSvelteBrowserImportPath,
    validateLocalSourceImportGraph,
    validateResolvedAppComponentPath,
    validateSvelteBrowserImportAliases,
} from "./build-validate";

export const DEFAULT_HTML_SHELL: HtmlShell = {
    appHtml: '<main id="app"></main>',
    lang: "en",
    title: "Svelte Builder",
};
const FINAL_HASH_HEX_LENGTH = 8;
const MAX_JS_HASH_STABILIZATION_PASSES = 32;

const validateOutDir = (rootDir: string, outDir: string, appSourceRoot: string): Result<string> => {
    if (!isPathWithinRoot(rootDir, outDir) || outDir === rootDir) {
        return fail(
            `Invalid outDir in ${CONFIG_FILE_NAME}: expected a dedicated build output directory inside the project root.`,
        );
    }

    if (isPathWithinRoot(outDir, appSourceRoot) || isPathWithinRoot(appSourceRoot, outDir)) {
        return fail(`Invalid outDir in ${CONFIG_FILE_NAME}: outDir must not overlap the app source tree.`);
    }

    return ok(outDir);
};


export const createHtmlShell = (mountId: string, appTitle = DEFAULT_HTML_SHELL.title): HtmlShell => ({
    appHtml: `<main id="${escapeHtml(mountId)}"></main>`,
    lang: "en",
    title: appTitle,
});

const createHex16Hash = (content: string): string =>
    new Bun.CryptoHasher("sha256").update(content).digest("hex").slice(0, FINAL_HASH_HEX_LENGTH);

const createFinalAssetFile = (content: string, extension: ".css" | ".js"): string => `${createHex16Hash(content)}${extension}`;

const formatBuildLogs = (logs: Array<{ message?: string; name?: string }>): string => {
    if (logs.length === 0) {
        return "Bun.build failed without diagnostic logs.";
    }

    return logs.map((log) => log.message ?? log.name ?? "Unknown build error").join("\n");
};

const getBuildErrorMessage = (error: unknown): string => {
    if (typeof error === "object" && error !== null && "logs" in error && Array.isArray(error.logs)) {
        return formatBuildLogs(error.logs as Array<{ message?: string; name?: string }>);
    }

    return getErrorMessage(error);
};

const prepareDir = async (path: string): Promise<Result<string>> => {
    const cleared = await rm(path, { force: true, recursive: true }).then(
        () => ok(path),
        (error) => fail(`Failed to clear ${path}: ${getErrorMessage(error)}`),
    );
    if (!cleared.ok) {
        return cleared;
    }

    return mkdir(path, { recursive: true }).then(
        () => ok(path),
        (error) => fail(`Failed to create ${path}: ${getErrorMessage(error)}`),
    );
};

const resolveSourcemapMode = (sourcemap: boolean | undefined): BuildConfig["sourcemap"] => (sourcemap ? "inline" : "none");

const writeJavaScriptAssets = async (outDir: string, assets: FinalJavaScriptAsset[]): Promise<Result<void>> => {
    const writes = Array.from(
        new Map(assets.map((asset) => [asset.finalFile, asset.content])).entries(),
        ([finalFile, content]) => writeFile(join(outDir, finalFile), content, "utf8"),
    );

    return Promise.all(writes).then(
        () => ok(undefined),
        (error) => fail(`Failed to write JavaScript assets: ${getErrorMessage(error)}`),
    );
};

const writeCssAsset = async (outDir: string, asset: { content: string; finalFile: string }): Promise<Result<string>> =>
    writeFile(join(outDir, asset.finalFile), asset.content, "utf8").then(
        () => ok(asset.finalFile),
        (error) => fail(`Failed to write ${asset.finalFile}: ${getErrorMessage(error)}`),
    );

const writeIndexHtml = async (outDir: string, shell: HtmlShell, jsFile: string, cssFile: string): Promise<Result<string>> => {
    const html = [
        "<!DOCTYPE html>",
        `<html lang="${escapeHtml(shell.lang)}">`,
        "<head>",
        '    <meta charset="UTF-8">',
        '    <meta name="viewport" content="width=device-width, initial-scale=1.0">',
        `    <title>${escapeHtml(shell.title)}</title>`,
        `    <link rel="stylesheet" href="/${cssFile}">`,
        "</head>",
        "<body>",
        `    ${shell.appHtml}`,
        `    <script type="module" src="/${jsFile}"></script>`,
        "</body>",
        "</html>",
    ].join("\n");

    return writeFile(join(outDir, "index.html"), html, "utf8").then(
        () => ok("index.html"),
        (error) => fail(`Failed to write index.html: ${getErrorMessage(error)}`),
    );
};

export const buildSvelte = async (options: BuildSvelteOptions = {}): Promise<Result<BuildArtifacts>> => {
    const rootDir = resolve(options.rootDir ?? process.cwd());
    const outDir = resolveConfiguredPath(rootDir, options.outDir, "dist");
    const mountId = validateMountId(options.mountId, "mountId");
    if (!mountId.ok) {
        return mountId;
    }
    const appComponent = validateAppComponent(options.appComponent, "appComponent");
    if (!appComponent.ok) {
        return appComponent;
    }
    const appComponentPath = resolveConfiguredPath(rootDir, appComponent.value, "src/App.svelte");
    const appSourceRoot = resolveAppSourceRoot(rootDir, appComponentPath);
    if (!appSourceRoot.ok) {
        return appSourceRoot;
    }
    const appTitle = options.appTitle ?? DEFAULT_HTML_SHELL.title;
    const buildNonce = createBuildNonce();
    const assetsDirs = await resolveConfiguredAssetsDirs(rootDir, options.assetsDirs, "assets");
    const stripSvelteDiagnostics = options.stripSvelteDiagnostics ?? true;
    let lockPath: string | null = null;
    let published = false;

    if (!assetsDirs.ok) {
        return fail(assetsDirs.error);
    }

    const validatedOutDir = validateOutDir(rootDir, outDir, appSourceRoot.value);
    if (!validatedOutDir.ok) {
        return validatedOutDir;
    }

    const stageDir = createStageDir(rootDir, validatedOutDir.value, buildNonce);
    const tempOutDir = createTempOutDir(validatedOutDir.value, buildNonce);

    const entryExists = await Bun.file(appComponentPath).exists();
    if (!entryExists) {
        return fail(`Missing SPA app component: ${appComponentPath}`);
    }

    const validatedAppComponentPath = validateResolvedAppComponentPath(rootDir, appSourceRoot.value, appComponentPath);
    if (!validatedAppComponentPath.ok) {
        return validatedAppComponentPath;
    }

    const validatedImportGraph = await validateLocalSourceImportGraph(appComponentPath, [realpathSync(appSourceRoot.value)]);
    if (!validatedImportGraph.ok) {
        return validatedImportGraph;
    }

    const validatedRuntimeAliases = await validateSvelteBrowserImportAliases(rootDir);
    if (!validatedRuntimeAliases.ok) {
        return validatedRuntimeAliases;
    }

    const lock = await acquirePublishLock(rootDir, validatedOutDir.value);
    if (!lock.ok) {
        return lock;
    }
    lockPath = lock.value;

    const outDirReady = await prepareDir(tempOutDir);
    if (!outDirReady.ok) {
        return outDirReady;
    }

    const stageDirReady = await prepareDir(stageDir);
    if (!stageDirReady.ok) {
        return stageDirReady;
    }
    const cssByPath = new Map<string, string>();
    const bootstrapPath = join(stageDir, "bootstrap.ts");
    const bootstrapSource = createBootstrapSource(createImportPath(stageDir, appComponentPath), mountId.value);
    const bootstrapWritten = await writeFile(bootstrapPath, bootstrapSource, "utf8").then(
        () => ok(undefined),
        (error) => fail(`Failed to write bootstrap: ${getErrorMessage(error)}`),
    );
    if (!bootstrapWritten.ok) {
        return bootstrapWritten;
    }

    try {
        const bundle = await Bun.build({
            entrypoints: [bootstrapPath],
            format: "esm",
            minify: true,
            naming: {
                asset: "[hash].[ext]",
                chunk: "[hash].[ext]",
                entry: "[hash].[ext]",
            },
            outdir: stageDir,
            plugins: [
                createSvelteRuntimeAliasPlugin(rootDir),
                stripSvelteDiagnostics ? createProductionEsmEnvPlugin() : null,
                createSveltePlugin(cssByPath),
            ].filter((plugin): plugin is BunPlugin => plugin !== null),
            sourcemap: resolveSourcemapMode(options.sourcemap),
            splitting: true,
            target: "browser",
        });
        if (!bundle.success) {
            return fail(formatBuildLogs(bundle.logs));
        }

        const rewrittenAssets = await finalizeJavaScriptAssets(
            bundle.outputs,
            createFinalAssetFile,
            MAX_JS_HASH_STABILIZATION_PASSES,
        );
        if (!rewrittenAssets.ok) {
            return rewrittenAssets;
        }

        const entryAsset = rewrittenAssets.value.find((asset) => asset.kind === "entry-point");
        if (!entryAsset) {
            return fail("Bun.build succeeded but emitted no JavaScript entry artifact.");
        }

        const cssAsset = await finalizeMergedCssAsset(cssByPath, createFinalAssetFile);
        if (!cssAsset.ok) {
            return cssAsset;
        }
        const jsWrite = await writeJavaScriptAssets(tempOutDir, rewrittenAssets.value);
        if (!jsWrite.ok) {
            return jsWrite;
        }

        const cssFile = await writeCssAsset(tempOutDir, cssAsset.value);
        if (!cssFile.ok) {
            return cssFile;
        }

        const htmlFile = await writeIndexHtml(
            tempOutDir,
            createHtmlShell(mountId.value, appTitle),
            entryAsset.finalFile,
            cssFile.value,
        );
        if (!htmlFile.ok) {
            return htmlFile;
        }

        for (const assetsDir of assetsDirs.value) {
            const assetsOutDir = join(tempOutDir, assetsDir.dirName);
            const copiedAssets = await copyConfiguredAssets(assetsDir.physicalPath, assetsOutDir);
            if (!copiedAssets.ok) {
                return fail(copiedAssets.error);
            }
        }

        const publishedOutDir = await publishBuildOutput(rootDir, tempOutDir, validatedOutDir.value);
        if (!publishedOutDir.ok) {
            return publishedOutDir;
        }
        published = true;

        return ok({
            cssFile: cssFile.value,
            htmlFile: htmlFile.value,
            jsChunkFiles: rewrittenAssets.value
                .filter((asset) => asset.kind === "chunk")
                .map((asset) => asset.finalFile)
                .sort(),
            jsFile: entryAsset.finalFile,
            outDir: validatedOutDir.value,
        });
    } catch (error) {
        return fail(getBuildErrorMessage(error));
    } finally {
        await rm(stageDir, { force: true, recursive: true }).catch(() => undefined);
        if (!published) {
            await rm(tempOutDir, { force: true, recursive: true }).catch(() => undefined);
        }
        if (lockPath) {
            await rm(lockPath, { force: true, recursive: true }).catch(() => undefined);
        }
    }
};

export const runConfiguredBuild = async (cwd = process.cwd()): Promise<Result<BuildArtifacts>> => {
    const config = await loadSvelteConfig(cwd);
    if (!config.ok) {
        return config;
    }

    return buildSvelte(config.value);
};

export const buildProduction = buildSvelte;

export const runBuildCli = async ({
    cwd = process.cwd(),
    error = console.error,
    format = formatBuildReport,
    log = console.log,
    run = runConfiguredBuild,
}: BuildCliDependencies = {}): Promise<number> => {
    const result = await run(cwd);
    if (!result.ok) {
        error(result.error);
        return 1;
    }

    log(format(result.value));
    return 0;
};

if (import.meta.main) {
    const exitCode = await runBuildCli();
    if (exitCode !== 0) {
        process.exit(exitCode);
    }
}
