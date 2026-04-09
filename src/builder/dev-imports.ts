import { dirname, isAbsolute, join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export const DEV_SPECIAL_IMPORTS = {
    "esm-env": "/_virtual/esm-env.js",
    svelte: "/_node_modules/svelte/src/index-client.js",
    "svelte/internal": "/_node_modules/svelte/src/internal/index.js",
    "svelte/internal/client": "/_node_modules/svelte/src/internal/client/index.js",
    "svelte/internal/disclose-version": "/_node_modules/svelte/src/internal/disclose-version.js",
} as const;

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const fail = (error: string): Result<never> => ({ ok: false, error });

const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) {
        return error.message;
    }

    return String(error);
};

const normalizeModulePath = (value: string): string => value.replace(/\\/g, "/");

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
                return fail(`Failed to read ${packageJsonPath}: ${getErrorMessage(error)}`);
            }

            const packageName =
                typeof packageJson === "object" && packageJson !== null && "name" in packageJson ? packageJson.name : undefined;
            if (typeof packageName !== "string" || packageName.length === 0) {
                return fail(`Missing package name in ${packageJsonPath}`);
            }

            return ok({ packageName, packageRoot: currentDir });
        }

        const parentDir = dirname(currentDir);
        if (parentDir === currentDir) {
            return fail(`Failed to resolve package root for ${importerPath}`);
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

export const resolveBareImportPathForDev = async (specifier: string, importerPath: string): Promise<Result<string>> => {
    const specialImport = DEV_SPECIAL_IMPORTS[specifier as keyof typeof DEV_SPECIAL_IMPORTS];
    if (specialImport !== undefined) {
        return ok(specialImport);
    }

    if (!isBareImportSpecifier(specifier)) {
        return ok(specifier);
    }

    const packageName = getPackageNameFromSpecifier(specifier);
    if (packageName.length === 0) {
        return fail(`Unsupported bare import in ${importerPath}: ${specifier}`);
    }

    const importerUrl = pathToFileURL(importerPath).href;

    if (isPackageImportSpecifier(specifier)) {
        const importerPackage = await resolveImporterPackageForDev(importerPath);
        if (!importerPackage.ok) {
            return importerPackage;
        }

        if (!isNodeModulesPackageRoot(importerPackage.value.packageRoot)) {
            return fail(`App-local package imports are not supported in dev: ${specifier} from ${importerPath}`);
        }

        return Promise.resolve()
            .then(() => import.meta.resolve(specifier, importerUrl))
            .then(
                (resolvedUrl) => {
                    if (!resolvedUrl.startsWith("file://")) {
                        return fail(`Unsupported resolved import for ${specifier}: ${resolvedUrl}`);
                    }

                    const resolvedPath = fileURLToPath(resolvedUrl);
                    const relativePath = relative(importerPackage.value.packageRoot, resolvedPath);
                    if (relativePath.length === 0 || relativePath.startsWith("..") || isAbsolute(relativePath)) {
                        return fail(`Resolved import escaped package root for ${specifier}: ${resolvedPath}`);
                    }

                    if (!isNodeModulesPackageRoot(importerPackage.value.packageRoot)) {
                        return ok(toRelativeImportSpecifier(importerPath, resolvedPath));
                    }

                    return ok(
                        `/_node_modules/${normalizeModulePath(importerPackage.value.packageName)}/${normalizeModulePath(relativePath)}`,
                    );
                },
                (error) => fail(`Failed to resolve ${specifier} from ${importerPath}: ${getErrorMessage(error)}`),
            );
    }

    return Promise.all([
        import.meta.resolve(specifier, importerUrl),
        import.meta.resolve(`${packageName}/package.json`, importerUrl),
    ]).then(
        ([resolvedUrl, packageJsonUrl]) => {
            if (!resolvedUrl.startsWith("file://") || !packageJsonUrl.startsWith("file://")) {
                return fail(`Unsupported resolved import for ${specifier}: ${resolvedUrl}`);
            }

            const resolvedPath = fileURLToPath(resolvedUrl);
            const packageRoot = dirname(fileURLToPath(packageJsonUrl));
            const relativePath = relative(packageRoot, resolvedPath);
            if (relativePath.length === 0 || relativePath.startsWith("..") || isAbsolute(relativePath)) {
                return fail(`Resolved import escaped package root for ${specifier}: ${resolvedPath}`);
            }

            return ok(`/_node_modules/${normalizeModulePath(packageName)}/${normalizeModulePath(relativePath)}`);
        },
        (error) => fail(`Failed to resolve ${specifier} from ${importerPath}: ${getErrorMessage(error)}`),
    );
};

const jsImportScanner = new Bun.Transpiler({ loader: "js" });

export const rewriteBareImportsForDev = async (source: string, importerPath: string): Promise<Result<string>> => {
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
