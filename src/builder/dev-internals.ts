import { join, relative, isAbsolute, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { getErrorMessage, normalizeModulePath, ok, err, type Result } from "./utils";

export type DevWatchRoot = {
    path: string;
    recursive: boolean;
};

export type DevWatchTarget =
    { kind: "config" } | { kind: "directory"; path: string } | { kind: "ignore" } | { kind: "module"; modulePath: string };

const DEV_CONFIG_FILE_NAME = "builder.ts";
const DEV_WATCH_DEBOUNCE_MS = 100;
const EXCLUDED_DIRS = ["node_modules", ".git", "dist"];

const isCompilableDevModule = (filePath: string): boolean =>
    [".svelte", ".ts", ".js", ".mjs"].some((extension) => filePath.endsWith(extension)) && !filePath.endsWith(".d.ts");

const isExcludedWatchDirectory = (dirName: string): boolean => EXCLUDED_DIRS.includes(dirName);

const getWatcherErrorCode = (error: unknown): string | undefined =>
    typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" ? error.code : undefined;

const isIgnorableDevWatcherError = (error: unknown): boolean => {
    const errorCode = getWatcherErrorCode(error);
    return errorCode === "ENOENT" || errorCode === "ENOTDIR";
};

export const classifyDevWatchTarget = ({
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

export const formatDevWatcherIssue = (context: string, error: unknown): string | undefined => {
    if (isIgnorableDevWatcherError(error)) {
        return undefined;
    }

    return `[svelte-dev] ${context}: ${getErrorMessage(error)}`;
};

export const shouldProcessDevWatchEvent = (
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

export const createSSEResponse = <TCache>(hub: {
    subscribe: (listener: (data: string) => void) => () => void;
}, signal: AbortSignal): Response => {
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
    assetsDirs: Array<{ physicalPath: string }>,
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

export const resolveBareImportPathForDev = async (specifier: string, importerPath: string): Promise<Result<string>> => {
    const DEV_SPECIAL_IMPORTS = {
        "esm-env": "/_virtual/esm-env.js",
        svelte: "/_node_modules/svelte/src/index-client.js",
        "svelte/internal": "/_node_modules/svelte/src/internal/index.js",
        "svelte/internal/client": "/_node_modules/svelte/src/internal/client/index.js",
        "svelte/internal/disclose-version": "/_node_modules/svelte/src/internal/disclose-version.js",
    } as const;

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
