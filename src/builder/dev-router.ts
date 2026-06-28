import { existsSync, lstatSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, relative } from "node:path";
import { ok, fail, type Result } from "./utils";

export const getRawRequestPathname = (requestUrl: string): string => {
    const schemeIndex = requestUrl.indexOf("://");
    const pathnameStart = schemeIndex === -1 ? requestUrl.indexOf("/") : requestUrl.indexOf("/", schemeIndex + 3);
    const pathnameWithQuery = pathnameStart === -1 ? "/" : requestUrl.slice(pathnameStart);
    const queryStart = pathnameWithQuery.search(/[?#]/);

    return queryStart === -1 ? pathnameWithQuery : pathnameWithQuery.slice(0, queryStart);
};

export const isPathInsideRoot = (rootDir: string, targetPath: string): boolean => {
    const relativePath = relative(rootDir, targetPath);

    return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
};

export const resolveDevRequestPath = async (
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

export const resolveDevNodeModuleRequestPath = async (
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
