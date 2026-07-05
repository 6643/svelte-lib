#!/usr/bin/env bun

import { existsSync, realpathSync } from "node:fs";

import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";

import { basename, dirname, join, relative, resolve } from "node:path";

import { compile } from "svelte/compiler";
import type { BuildConfig, BunPlugin } from "bun";

import { copyConfiguredAssets, resolveConfiguredAssetsDirs, type ResolvedAssetsDir } from "./assets";
import { formatBuildReport } from "./report";
import {
    createBootstrapSource,
    createProductionEsmEnvPlugin,
    createSveltePlugin as createSharedSveltePlugin,
    createSvelteRuntimeAliasPlugin,
    validateLocalSourceImportGraph,
    validateSvelteBrowserImportAliases,
} from "./build-internals";
import {
    ok,
    err,
    getErrorMessage,
    getErrorCode,
    isPathWithinRoot,
    isPathWithinAnyRoot,
    formatBuildLogs,
    getBuildErrorMessage,
    normalizeModulePath,
    resolveConfiguredPath,
    type Result,
} from "./utils";
import {
    CONFIG_FILE_NAME,
    defineSvelteConfig,
    loadSvelteConfig,
    resolveAppSourceRoot,
    validateResolvedAppComponentPath,
    type BuildSvelteOptions,
} from "./config";

export {
    ok,
    err,
    getErrorMessage,
    getErrorCode,
    isPathWithinRoot,
    formatBuildLogs,
    getBuildErrorMessage,
    normalizeModulePath,
    resolveConfiguredPath,
    type Result,
} from "./utils";

export { defineSvelteConfig, loadSvelteConfig, type BuildSvelteOptions } from "./config";

const escapeHtml = (value: string): string =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const createImportPath = (fromDir: string, toPath: string): string => {
    const importPath = normalizeModulePath(relative(fromDir, toPath));

    return importPath.startsWith(".") ? importPath : `./${importPath}`;
};

// Type-only export for editor/type-checker consumers.
// Build/dev replace this module with a generated runtime module that embeds the configured mount id.
export declare const mountId: string;

const readRequiredText = async (path: string): Promise<Result<string>> => {
    const file = Bun.file(path);
    const exists = await file.exists();
    if (!exists) return err(`Missing file: ${path}`);

    return file.text().then(
        (value) => ok(value),
        (error) => err(`Failed to read ${path}: ${getErrorMessage(error)}`),
    );
};

const compileSvelteModule = async (path: string): Promise<Result<{ css: string; js: string }>> => {
    const source = await readRequiredText(path);
    if (!source.ok) return source;

    return Promise.resolve()
        .then(() =>
            compile(source.value, {
                css: "external",
                cssHash: ({ css, hash }) => `_${hash(css)}`,
                dev: false,
                filename: path,
                generate: "client",
            }),
        )
        .then(
            ({ css, js }) => ok({ css: css?.code ?? "", js: js.code }),
            (error) => err(`Failed to compile ${path}: ${getErrorMessage(error)}`),
        );
};

type HtmlShell = {
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

const DEFAULT_HTML_SHELL: HtmlShell = {
    appHtml: '<main id="app"></main>',
    lang: "en",
    title: "Svelte Builder",
};

const createContentHash = (content: string, length: number): string =>
    new Bun.CryptoHasher("sha256").update(content).digest("hex").slice(0, length);

const minifyCss = async (content: string): Promise<string> => {
    const tmpDir = await mkdtemp(join(tmpdir(), "svelte-lib-css-"));
    const tempFile = join(tmpDir, "input.css");
    try {
        await writeFile(tempFile, content, "utf8");
        const result = await Bun.build({
            entrypoints: [tempFile],
            minify: true,
            target: "browser",
        } as BuildConfig);
        if (!result.success) return content;
        const asset = result.outputs.find((o) => o.path.endsWith(".css"));
        return asset ? (await asset.text()).trimEnd() : content;
    } catch {
        return content;
    } finally {
        await rm(tmpDir, { force: true, recursive: true }).catch(() => undefined);
    }
};

const validateOutDir = (rootDir: string, outDir: string, appSourceRoot: string): Result<string> => {
    if (!isPathWithinRoot(rootDir, outDir) || outDir === rootDir) {
        return err(
            `Invalid outDir in ${CONFIG_FILE_NAME}: expected a dedicated build output directory inside the project root.`,
        );
    }

    if (isPathWithinRoot(outDir, appSourceRoot) || isPathWithinRoot(appSourceRoot, outDir)) {
        return err(`Invalid outDir in ${CONFIG_FILE_NAME}: outDir must not overlap the app source tree.`);
    }

    return ok(outDir);
};

const resolvePhysicalTargetPath = (path: string): Result<string> => {
    const pendingSegments: string[] = [];
    let currentPath = path;

    while (!existsSync(currentPath)) {
        const parentPath = dirname(currentPath);
        if (parentPath === currentPath) {
            return err(`Invalid outDir in ${CONFIG_FILE_NAME}: expected an existing parent directory.`);
        }
        pendingSegments.unshift(basename(currentPath));
        currentPath = parentPath;
    }

    try {
        return ok(join(realpathSync(currentPath), ...pendingSegments));
    } catch (error) {
        return err(`Invalid outDir in ${CONFIG_FILE_NAME}: failed to resolve physical path: ${getErrorMessage(error)}`);
    }
};

const validatePhysicalOutDir = (rootDir: string, outDir: string): Result<string> => {
    const physicalRootDir = (() => {
        try {
            return realpathSync(rootDir);
        } catch (error) {
            return err(`Invalid rootDir in ${CONFIG_FILE_NAME}: failed to resolve physical path: ${getErrorMessage(error)}`);
        }
    })();
    if (typeof physicalRootDir !== "string") return physicalRootDir;

    const physicalOutDir = resolvePhysicalTargetPath(outDir);
    if (!physicalOutDir.ok) return physicalOutDir;

    if (!isPathWithinRoot(physicalRootDir, physicalOutDir.value)) {
        return err(`Invalid outDir in ${CONFIG_FILE_NAME}: symbolic links must resolve inside the project root.`);
    }

    return physicalOutDir;
};

const validateOutDirDoesNotOverlapAssets = (physicalOutDir: string, assetsDirs: ResolvedAssetsDir[]): Result<void> => {
    const overlappingAssetsDir = assetsDirs.find(
        (assetsDir) =>
            isPathWithinRoot(assetsDir.physicalPath, physicalOutDir) ||
            isPathWithinRoot(physicalOutDir, assetsDir.physicalPath),
    );

    if (overlappingAssetsDir !== undefined) {
        return err(`Configured assets directory overlaps the build output tree: ${overlappingAssetsDir.physicalPath}`);
    }

    return ok(undefined);
};

const createHtmlShell = (mountId: string, appTitle = DEFAULT_HTML_SHELL.title): HtmlShell => ({
    appHtml: `<main id="${escapeHtml(mountId)}"></main>`,
    lang: "en",
    title: appTitle,
});

const prepareDir = async (path: string): Promise<Result<string>> =>
    rm(path, { force: true, recursive: true }).then(
        () => mkdir(path, { recursive: true }),
        (error) => Promise.reject(error),
    ).then(
        () => ok(path),
        (error) => err(`Failed to create ${path}: ${getErrorMessage(error)}`),
    );

const writeIndexHtml = async (outDir: string, shell: HtmlShell, jsFile: string, cssFile: string): Promise<Result<string>> => {
    const cssLink = cssFile ? `    <link rel="stylesheet" href="/${cssFile}">\n` : "";
    const html = [
        "<!DOCTYPE html>",
        `<html lang="${escapeHtml(shell.lang)}">`,
        "<head>",
        '    <meta charset="UTF-8">',
        '    <meta name="viewport" content="width=device-width, initial-scale=1.0">',
        `    <title>${escapeHtml(shell.title)}</title>`,
        cssLink.trimEnd(),
        "</head>",
        "<body>",
        `    ${shell.appHtml}`,
        `    <script type="module" src="/${jsFile}"></script>`,
        "</body>",
        "</html>",
    ].join("\n");

    return writeFile(join(outDir, "index.html"), html, "utf8").then(
        () => ok("index.html"),
        (error) => err(`Failed to write index.html: ${getErrorMessage(error)}`),
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
    const physicalOutDir = validatePhysicalOutDir(rootDir, validatedOutDir.value);
    if (!physicalOutDir.ok) return physicalOutDir;
    const validatedAssetRoots = validateOutDirDoesNotOverlapAssets(physicalOutDir.value, assetsDirs.value);
    if (!validatedAssetRoots.ok) return validatedAssetRoots;

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
    if (!entryExists) return err(`Missing SPA app component: ${ctx.appComponentPath}`);

    const validatedPath = validateResolvedAppComponentPath(ctx.rootDir, ctx.appSourceRoot, ctx.appComponentPath);
    if (!validatedPath.ok) return validatedPath;

    const validatedGraph = await validateLocalSourceImportGraph(ctx.appComponentPath, [realpathSync(ctx.appSourceRoot)]);
    if (!validatedGraph.ok) return validatedGraph;

    const validatedAliases = await validateSvelteBrowserImportAliases(ctx.rootDir);
    if (!validatedAliases.ok) return validatedAliases;

    return ok(undefined);
};

const validateMountId = (value: unknown, field: string): Result<string> => {
    if (value !== undefined && typeof value !== "string") {
        return err(`Invalid ${field} in ${CONFIG_FILE_NAME}: expected string.`);
    }
    const mountId = value ?? "app";
    const normalizedMountId = mountId.trim();
    if (normalizedMountId.length === 0) {
        return err(`Invalid ${field} in ${CONFIG_FILE_NAME}: expected a non-empty id token.`);
    }
    if (normalizedMountId !== mountId || /\s/u.test(normalizedMountId) || normalizedMountId.startsWith("#")) {
        return err(`Invalid ${field} in ${CONFIG_FILE_NAME}: expected a plain id token, not a selector-shaped value.`);
    }
    return ok(normalizedMountId);
};

const validateAppComponent = (value: unknown, field: string): Result<string> => {
    if (value !== undefined && typeof value !== "string") {
        return err(`Invalid ${field} in ${CONFIG_FILE_NAME}: expected string.`);
    }
    const appComponent = value ?? "src/App.svelte";
    const normalizedAppComponent = appComponent.trim();
    if (normalizedAppComponent.length === 0) {
        return err(`Invalid ${field} in ${CONFIG_FILE_NAME}: expected a non-empty component path.`);
    }
    if (normalizedAppComponent !== appComponent) {
        return err(`Invalid ${field} in ${CONFIG_FILE_NAME}: expected a plain component path, not a whitespace-padded value.`);
    }
    return ok(normalizedAppComponent);
};

const buildSvelte = async (options: BuildSvelteOptions = {}): Promise<Result<BuildArtifacts>> => {
    const rootDir = resolve(options.rootDir ?? process.cwd());

    // 1. Resolve and validate config
    const ctx = await resolveBuildContext(rootDir, options);
    if (!ctx.ok) return ctx;

    // 2. Verify build inputs
    const verified = await verifyBuildInputs(ctx.value);
    if (!verified.ok) return verified;

    // 3. Prepare output directory
    const outDirReady = await prepareDir(ctx.value.outDir);
    if (!outDirReady.ok) return outDirReady;

    // 4. Generate bootstrap
    const stageDir = await mkdtemp(join(ctx.value.rootDir, ".bsp-stage-"));
    try {
        const bootstrapSource = createBootstrapSource(
            createImportPath(stageDir, ctx.value.appComponentPath),
            ctx.value.mountId,
        );
        const bootstrapPath = join(stageDir, "bootstrap.ts");
        await writeFile(bootstrapPath, bootstrapSource, "utf8");

        // 5. Bun.build directly to outDir
        const cssByPath = new Map<string, string>();
        const bundle = await Bun.build({
            entrypoints: [bootstrapPath],
            outdir: ctx.value.outDir,
            format: "esm",
            minify: true,
            naming: {
                asset: "[hash].[ext]",
                chunk: "[hash].[ext]",
                entry: "[hash].[ext]",
            },
            plugins: [
                createSvelteRuntimeAliasPlugin(ctx.value.rootDir),
                ctx.value.stripSvelteDiagnostics ? createProductionEsmEnvPlugin() : null,
                createSharedSveltePlugin(cssByPath, compileSvelteModule),
            ].filter((plugin): plugin is BunPlugin => plugin !== null),
            sourcemap: ctx.value.sourcemap ? "inline" : ("none" as BuildConfig["sourcemap"]),
            splitting: true,
            target: "browser",
        });
        if (!bundle.success) return err(formatBuildLogs(bundle.logs));

        // 6. Clean up bootstrap temp file
        await rm(stageDir, { force: true, recursive: true }).catch(() => undefined);

        // 7. Find entry JS and chunks
        const outputs = bundle.outputs;
        const entryOutput = outputs.find((o) => o.kind === "entry-point" && o.path.endsWith(".js"));
        if (!entryOutput) return err("Bun.build succeeded but emitted no JavaScript entry artifact.");
        const entryFile = basename(entryOutput.path);
        const chunkFiles = outputs
            .filter((o) => o.kind === "chunk" && o.path.endsWith(".js"))
            .map((o) => basename(o.path))
            .sort();

        // 8. Merge CSS and write
        const cssContent = Array.from(cssByPath.values()).join("\n");
        const cssMinified = cssContent.length > 0 ? await minifyCss(cssContent) : "";
        const cssFile = cssMinified.length > 0 ? `${createContentHash(cssMinified, 8)}.css` : "";
        if (cssFile) {
            await writeFile(join(ctx.value.outDir, cssFile), cssMinified, "utf8");
        }

        // 9. Generate HTML
        const htmlFile = "index.html";
        await writeIndexHtml(ctx.value.outDir, createHtmlShell(ctx.value.mountId, ctx.value.appTitle), entryFile, cssFile);

        // 10. Copy assets
        for (const assetsDir of ctx.value.assetsDirs) {
            const assetsOutDir = join(ctx.value.outDir, assetsDir.dirName);
            const copied = await copyConfiguredAssets(assetsDir.physicalPath, assetsOutDir);
            if (!copied.ok) return copied;
        }

        return ok({
            cssFile,
            htmlFile,
            jsChunkFiles: chunkFiles,
            jsFile: entryFile,
            outDir: ctx.value.outDir,
        });
    } finally {
        await rm(stageDir, { force: true, recursive: true }).catch(() => undefined);
    }
};

const runConfiguredBuild = async (cwd = process.cwd()): Promise<Result<BuildArtifacts>> => {
    const config = await loadSvelteConfig(cwd);
    if (!config.ok) {
        return config;
    }

    return buildSvelte(config.value);
};

export const build = async (options: BuildSvelteOptions = {}): Promise<Result<BuildArtifacts>> => buildSvelte(options);

const runBuildCli = async ({
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

export const serve = async ({ cwd = process.cwd() }: BuildCliDependencies = {}): Promise<Result<BuildArtifacts>> =>
    runConfiguredBuild(cwd);

if (import.meta.main) {
    const exitCode = await runBuildCli();
    if (exitCode !== 0) {
        process.exit(exitCode);
    }
}
