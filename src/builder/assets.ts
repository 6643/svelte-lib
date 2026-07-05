import { cp, realpath, stat } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { ok, err, getErrorCode, isPathWithinRoot, type Result } from "./utils";
export type ResolvedAssetsDir = {
    dirName: string;
    physicalPath: string;
};

const resolvePathWithinRoot = (rootPath: string, requestedPath: string): Result<string> => {
    const resolvedPath = resolve(rootPath, requestedPath);

    if (!isPathWithinRoot(rootPath, resolvedPath)) {
        return err(`Requested asset path escapes assets root: ${requestedPath}`);
    }

    return ok(resolvedPath);
};

const resolvePhysicalPath = async (path: string): Promise<Result<string>> =>
    realpath(path).then(
        (value) => ok(value),
        (error: unknown) =>
            err(`Failed to resolve physical path ${path}: ${error instanceof Error ? error.message : String(error)}`),
    );

const resolvePhysicalChildPath = async (path: string): Promise<Result<string>> => {
    const physicalParent = await resolvePhysicalPath(dirname(path));
    if (!physicalParent.ok) {
        return physicalParent;
    }

    return ok(join(physicalParent.value, basename(path)));
};

const resolveConfiguredAssetsDir = async (
    rootDir: string,
    assetsDir: string | undefined,
    defaultAssetsDir?: string,
): Promise<Result<string | undefined>> => {
    const configuredAssetsDir = assetsDir ?? defaultAssetsDir;
    if (configuredAssetsDir === undefined) {
        return ok(undefined);
    }

    const resolvedDir = isAbsolute(configuredAssetsDir) ? configuredAssetsDir : resolve(rootDir, configuredAssetsDir);
    const allowMissing = assetsDir === undefined && defaultAssetsDir !== undefined;

    const info = await stat(resolvedDir).then(
        (value) => ok(value),
        (error: unknown) => {
            const code = getErrorCode(error);
            if (code === "ENOENT" || code === "ENOTDIR") {
                return allowMissing
                    ? ok(undefined)
                    : err(`Missing configured assets directory: ${configuredAssetsDir} (resolved to ${resolvedDir})`);
            }

            return err(
                `Failed to inspect configured assets directory ${configuredAssetsDir} (resolved to ${resolvedDir}): ${
                    error instanceof Error ? error.message : String(error)
                }`,
            );
        },
    );
    if (!info.ok) {
        return info;
    }

    if (info.value === undefined) {
        return ok(undefined);
    }

    if (!info.value.isDirectory()) {
        return err(`Configured assetsDirs entry is not a directory: ${configuredAssetsDir} (resolved to ${resolvedDir})`);
    }

    const physicalRoot = await resolvePhysicalPath(rootDir);
    if (!physicalRoot.ok) {
        return physicalRoot;
    }

    const physicalDir = await resolvePhysicalPath(resolvedDir);
    if (!physicalDir.ok) {
        return physicalDir;
    }

    if (!isPathWithinRoot(physicalRoot.value, physicalDir.value)) {
        return err(`Configured assetsDirs entry is outside the project root: ${configuredAssetsDir}`);
    }

    return ok(physicalDir.value);
};

export const resolveConfiguredAssetsDirs = async (
    rootDir: string,
    assetsDirs?: string[],
    defaultAssetsDir = "assets",
): Promise<Result<ResolvedAssetsDir[]>> => {
    if (assetsDirs === undefined) {
        const defaultDir = await resolveConfiguredAssetsDir(rootDir, undefined, defaultAssetsDir);
        if (!defaultDir.ok) {
            return defaultDir;
        }

        if (defaultDir.value === undefined) {
            return ok([]);
        }

        return ok([
            {
                dirName: basename(defaultDir.value),
                physicalPath: defaultDir.value,
            },
        ]);
    }

    const configuredAssetsDirs = assetsDirs;
    if (!Array.isArray(configuredAssetsDirs)) {
        return err("Invalid assetsDirs in builder.ts: expected string array.");
    }

    const resolvedEntries: ResolvedAssetsDir[] = [];
    const seenDirNames = new Set<string>();

    for (const configuredAssetsDir of configuredAssetsDirs) {
        if (typeof configuredAssetsDir !== "string") {
            return err("Invalid assetsDirs in builder.ts: expected string array.");
        }

        const resolvedDir = await resolveConfiguredAssetsDir(rootDir, configuredAssetsDir);
        if (!resolvedDir.ok) {
            return resolvedDir;
        }

        if (resolvedDir.value === undefined) {
            continue;
        }

        const dirName = basename(resolvedDir.value);
        if (seenDirNames.has(dirName)) {
            return err(`Duplicate assets directory name in builder.ts: ${dirName}`);
        }

        seenDirNames.add(dirName);
        resolvedEntries.push({
            dirName,
            physicalPath: resolvedDir.value,
        });
    }

    return ok(resolvedEntries);
};

export const resolveAssetPath = (assetsRoot: string, requestedPath: string): Result<string> =>
    resolvePathWithinRoot(assetsRoot, requestedPath);

export const resolvePhysicalAssetPath = async (assetsRoot: string, requestedPath: string): Promise<Result<string>> => {
    const lexicalPath = resolveAssetPath(assetsRoot, requestedPath);
    if (!lexicalPath.ok) {
        return lexicalPath;
    }

    const physicalPath = await resolvePhysicalPath(lexicalPath.value);
    if (!physicalPath.ok) {
        return physicalPath;
    }

    if (!isPathWithinRoot(assetsRoot, physicalPath.value)) {
        return err(`Requested asset path resolves outside assets root: ${requestedPath}`);
    }

    return ok(physicalPath.value);
};

const validateAssetCopyRoots = (assetsRoot: string, assetsOutDir: string): Result<void> => {
    if (isPathWithinRoot(assetsRoot, assetsOutDir)) {
        return err(`Configured assets directory overlaps the build output tree: ${assetsOutDir}`);
    }

    if (isPathWithinRoot(assetsOutDir, assetsRoot)) {
        return err(`Configured assets directory overlaps the build output tree: ${assetsRoot}`);
    }

    return ok(undefined);
};

export const copyConfiguredAssets = async (assetsRoot: string, assetsOutDir: string): Promise<Result<string>> => {
    const physicalAssetsRoot = await resolvePhysicalPath(assetsRoot);
    if (!physicalAssetsRoot.ok) {
        return physicalAssetsRoot;
    }

    const physicalAssetsOutDir = await resolvePhysicalChildPath(assetsOutDir);
    if (!physicalAssetsOutDir.ok) {
        return physicalAssetsOutDir;
    }

    const roots = validateAssetCopyRoots(physicalAssetsRoot.value, physicalAssetsOutDir.value);
    if (!roots.ok) {
        return roots;
    }

    const copied = await cp(physicalAssetsRoot.value, physicalAssetsOutDir.value, {
      recursive: true,
    }).then(
      () => ok(assetsOutDir),
      (error) => err(`Failed to copy assets: ${error instanceof Error ? error.message : String(error)}`),
    );
    if (!copied.ok) {
        return copied;
    }

    return ok(assetsOutDir);
};
