#!/usr/bin/env bun

import { realpathSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { BuildArtifact, BuildConfig, BunPlugin } from "bun";
import { createBootstrapSource, createImportPath } from "./bootstrap";
import {
    CONFIG_FILE_NAME,
    defineSvelteConfig,
    loadSvelteConfig,
    type BuildSvelteOptions,
    validateAppComponent,
    validateMountId,
} from "./build-config";
import { copyConfiguredAssets, resolveConfiguredAssetsDirs, type ResolvedAssetsDir } from "./assets";
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
} from "./import-utils";
import { ok, fail, getErrorMessage, isPathWithinRoot, resolveConfiguredPath, type Result } from "./utils";

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

/* ── Types for pipeline step communication ── */

type BuildContext = {
    rootDir: string;
    outDir: string;
    mountId: string;
    appTitle: string;
    appComponentPath: string;
    appSourceRoot: string;
    assetsDirs: ResolvedAssetsDir[];
    stripSvelteDiagnostics: boolean;
    sourcemap: boolean;
};

type BuildDirectories = {
    stageDir: string;
    tempOutDir: string;
    lockPath: string | null;
    bootstrapPath: string;
};

type BuildBundle = {
    outputs: BuildArtifact[];
    cssByPath: Map<string, string>;
};

/* ── Pipeline step: resolve and validate config ── */

const resolveBuildContext = async (rootDir: string, options: BuildSvelteOptions): Promise<Result<BuildContext>> => {
    const outDirRaw = resolveConfiguredPath(rootDir, options.outDir, "dist");
    const mountId = validateMountId(options.mountId, "mountId");
    if (!mountId.ok) return mountId;
    const appComponent = validateAppComponent(options.appComponent, "appComponent");
    if (!appComponent.ok) return appComponent;
    const appComponentPath = resolveConfiguredPath(rootDir, appComponent.value, "src/App.svelte");
    const appSourceRoot = resolveAppSourceRoot(rootDir, appComponentPath);
    if (!appSourceRoot.ok) return appSourceRoot;
    const assetsDirs = await resolveConfiguredAssetsDirs(rootDir, options.assetsDirs, "assets");
    if (!assetsDirs.ok) return assetsDirs;

    const validatedOutDir = validateOutDir(rootDir, outDirRaw, appSourceRoot.value);
    if (!validatedOutDir.ok) return validatedOutDir;

    return ok({
        rootDir,
        outDir: validatedOutDir.value,
        mountId: mountId.value,
        appTitle: options.appTitle ?? DEFAULT_HTML_SHELL.title,
        appComponentPath,
        appSourceRoot: appSourceRoot.value,
        assetsDirs: assetsDirs.value,
        stripSvelteDiagnostics: options.stripSvelteDiagnostics ?? true,
        sourcemap: options.sourcemap ?? false,
    });
};

/* ── Pipeline step: verify file existence, imports, aliases ── */

const verifyBuildInputs = async (ctx: BuildContext): Promise<Result<void>> => {
    const entryExists = await Bun.file(ctx.appComponentPath).exists();
    if (!entryExists) return fail(`Missing SPA app component: ${ctx.appComponentPath}`);

    const validatedPath = validateResolvedAppComponentPath(ctx.rootDir, ctx.appSourceRoot, ctx.appComponentPath);
    if (!validatedPath.ok) return validatedPath;

    const validatedGraph = await validateLocalSourceImportGraph(ctx.appComponentPath, [realpathSync(ctx.appSourceRoot)]);
    if (!validatedGraph.ok) return validatedGraph;

    const validatedAliases = await validateSvelteBrowserImportAliases(ctx.rootDir);
    if (!validatedAliases.ok) return validatedAliases;

    return ok(undefined);
};

/* ── Pipeline step: create stage/temp dirs, acquire lock ── */

const setupBuildDirectories = async (ctx: BuildContext): Promise<Result<BuildDirectories>> => {
    const buildNonce = createBuildNonce();
    const stageDir = createStageDir(ctx.rootDir, ctx.outDir, buildNonce);
    const tempOutDir = createTempOutDir(ctx.outDir, buildNonce);

    const lock = await acquirePublishLock(ctx.rootDir, ctx.outDir);
    if (!lock.ok) return lock;

    const outDirReady = await prepareDir(tempOutDir);
    if (!outDirReady.ok) return outDirReady;

    const stageDirReady = await prepareDir(stageDir);
    if (!stageDirReady.ok) return stageDirReady;

    const bootstrapPath = join(stageDir, "bootstrap.ts");
    const bootstrapSource = createBootstrapSource(createImportPath(stageDir, ctx.appComponentPath), ctx.mountId);
    const bootstrapWritten = await writeFile(bootstrapPath, bootstrapSource, "utf8").then(
        () => ok(bootstrapPath),
        (error) => fail(`Failed to write bootstrap: ${getErrorMessage(error)}`),
    );
    if (!bootstrapWritten.ok) return bootstrapWritten;

    return ok({ lockPath: lock.value, stageDir, tempOutDir, bootstrapPath });
};

/* ── Pipeline step: run Bun.build ── */

const runBunBuild = async (ctx: BuildContext, dirs: BuildDirectories): Promise<Result<BuildBundle>> => {
    const cssByPath = new Map<string, string>();
    const bundle = await Bun.build({
        entrypoints: [dirs.bootstrapPath],
        format: "esm",
        minify: true,
        naming: {
            asset: "[hash].[ext]",
            chunk: "[hash].[ext]",
            entry: "[hash].[ext]",
        },
        outdir: dirs.stageDir,
        plugins: [
            createSvelteRuntimeAliasPlugin(ctx.rootDir),
            ctx.stripSvelteDiagnostics ? createProductionEsmEnvPlugin() : null,
            createSveltePlugin(cssByPath),
        ].filter((plugin): plugin is BunPlugin => plugin !== null),
        sourcemap: ctx.sourcemap ? "inline" : ("none" as BuildConfig["sourcemap"]),
        splitting: true,
        target: "browser",
    });
    if (!bundle.success) return fail(formatBuildLogs(bundle.logs));

    // yield outputs immediately; finalize steps handle writing
    return ok({ outputs: bundle.outputs, cssByPath });
};

/* ── Pipeline step: finalize JavaScript assets (hash stabilization) ── */

const finalizeJS = async (bundle: BuildBundle): Promise<Result<{ entryAsset: FinalJavaScriptAsset; assets: FinalJavaScriptAsset[] }>> => {
    const rewrittenAssets = await finalizeJavaScriptAssets(bundle.outputs, createFinalAssetFile, MAX_JS_HASH_STABILIZATION_PASSES);
    if (!rewrittenAssets.ok) return rewrittenAssets;

    const entryAsset = rewrittenAssets.value.find((asset) => asset.kind === "entry-point");
    if (!entryAsset) return fail("Bun.build succeeded but emitted no JavaScript entry artifact.");

    return ok({ entryAsset, assets: rewrittenAssets.value });
};

/* ── Pipeline step: finalize CSS ── */

const finalizeCSS = async (bundle: BuildBundle): Promise<Result<{ content: string; finalFile: string }>> => {
    const cssAsset = await finalizeMergedCssAsset(bundle.cssByPath, createFinalAssetFile);
    if (!cssAsset.ok) return cssAsset;
    return ok(cssAsset.value);
};

/* ── Shared cleanup ── */

const cleanupBuild = async (lockPath: string | null, stageDir: string, tempOutDir: string, published: boolean): Promise<void> => {
    await rm(stageDir, { force: true, recursive: true }).catch(() => undefined);
    if (!published) {
        await rm(tempOutDir, { force: true, recursive: true }).catch(() => undefined);
    }
    if (lockPath) {
        await rm(lockPath, { force: true, recursive: true }).catch(() => undefined);
    }
};

export const buildSvelte = async (options: BuildSvelteOptions = {}): Promise<Result<BuildArtifacts>> => {
    const rootDir = resolve(options.rootDir ?? process.cwd());

    const ctx = await resolveBuildContext(rootDir, options);
    if (!ctx.ok) return ctx;

    const verified = await verifyBuildInputs(ctx.value);
    if (!verified.ok) return verified;

    const dirs = await setupBuildDirectories(ctx.value);
    if (!dirs.ok) {
        await cleanupBuild(null, "", "", false);
        return dirs;
    }

    const bundle = await runBunBuild(ctx.value, dirs.value);
    if (!bundle.ok) {
        await cleanupBuild(dirs.value.lockPath, dirs.value.stageDir, dirs.value.tempOutDir, false);
        return bundle;
    }

    const js = await finalizeJS(bundle.value);
    if (!js.ok) {
        await cleanupBuild(dirs.value.lockPath, dirs.value.stageDir, dirs.value.tempOutDir, false);
        return js;
    }

    const css = await finalizeCSS(bundle.value);
    if (!css.ok) {
        await cleanupBuild(dirs.value.lockPath, dirs.value.stageDir, dirs.value.tempOutDir, false);
        return css;
    }

    const jsWrite = await writeJavaScriptAssets(dirs.value.tempOutDir, js.value.assets);
    if (!jsWrite.ok) {
        await cleanupBuild(dirs.value.lockPath, dirs.value.stageDir, dirs.value.tempOutDir, false);
        return jsWrite;
    }

    const cssFile = await writeCssAsset(dirs.value.tempOutDir, css.value);
    if (!cssFile.ok) {
        await cleanupBuild(dirs.value.lockPath, dirs.value.stageDir, dirs.value.tempOutDir, false);
        return cssFile;
    }

    const htmlFile = await writeIndexHtml(
        dirs.value.tempOutDir,
        createHtmlShell(ctx.value.mountId, ctx.value.appTitle),
        js.value.entryAsset.finalFile,
        cssFile.value,
    );
    if (!htmlFile.ok) {
        await cleanupBuild(dirs.value.lockPath, dirs.value.stageDir, dirs.value.tempOutDir, false);
        return htmlFile;
    }

    for (const assetsDir of ctx.value.assetsDirs) {
        const assetsOutDir = join(dirs.value.tempOutDir, assetsDir.dirName);
        const copied = await copyConfiguredAssets(assetsDir.physicalPath, assetsOutDir);
        if (!copied.ok) {
            await cleanupBuild(dirs.value.lockPath, dirs.value.stageDir, dirs.value.tempOutDir, false);
            return fail(copied.error);
        }
    }

    const published = await publishBuildOutput(ctx.value.rootDir, dirs.value.tempOutDir, ctx.value.outDir);
    if (!published.ok) {
        await cleanupBuild(dirs.value.lockPath, dirs.value.stageDir, dirs.value.tempOutDir, false);
        return published;
    }

    await cleanupBuild(dirs.value.lockPath, dirs.value.stageDir, dirs.value.tempOutDir, true);

    return ok({
        cssFile: cssFile.value,
        htmlFile: htmlFile.value,
        jsChunkFiles: js.value.assets
            .filter((asset) => asset.kind === "chunk")
            .map((asset) => asset.finalFile)
            .sort(),
        jsFile: js.value.entryAsset.finalFile,
        outDir: ctx.value.outDir,
    });
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
