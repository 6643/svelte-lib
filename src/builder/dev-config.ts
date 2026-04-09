import { realpathSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import type { BuildSvelteOptions, Result } from "./build";
import {
    resolveAppSourceRoot,
    validateLocalSourceImportGraph,
    validateResolvedAppComponentPath,
    validateSvelteBrowserImportAliases,
} from "./build";
import { resolveConfiguredAssetsDirs, type ResolvedAssetsDir } from "./assets";
import { resolveConfiguredPath } from "./bootstrap";

type DevRuntimeState = {
    appComponentPath: string;
    appTitle: string;
    assetsDirs: ResolvedAssetsDir[];
    mountId: string;
    sourcePathPrefix: string | undefined;
    sourceRoot: string;
    watchRoots: DevWatchRoot[];
};

export type DevWatchRoot = {
    path: string;
    recursive: boolean;
};

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const fail = (error: string): Result<never> => ({ ok: false, error });

const normalizeModulePath = (value: string): string => value.replace(/\\/g, "/");

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

export const resolveDevWatchRoots = (
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

export const deriveDevRuntimeState = async (
    config: BuildSvelteOptions,
    cwd = process.cwd(),
): Promise<Result<DevRuntimeState>> => {
    const rootDir = config.rootDir ?? cwd;
    const mountId = config.mountId ?? "app";
    const appTitle = config.appTitle ?? "Svelte Builder";
    const appComponentPath = resolveConfiguredPath(rootDir, config.appComponent, "src/App.svelte");
    const sourceRoot = resolveAppSourceRoot(rootDir, appComponentPath);
    if (!sourceRoot.ok) {
        return sourceRoot;
    }

    const appComponentExists = await Bun.file(appComponentPath).exists();
    if (!appComponentExists) {
        return fail(`Missing SPA app component: ${appComponentPath}`);
    }

    const validatedAppComponentPath = validateResolvedAppComponentPath(rootDir, sourceRoot.value, appComponentPath);
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

export type { DevRuntimeState };
