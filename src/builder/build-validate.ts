import { existsSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "svelte/compiler";
import { CONFIG_FILE_NAME } from "./build-config";
import {
    formatSupportedLocalSourceModuleExtensions,
    isSupportedLocalSourceModule,
    isSupportedSvelteSourceModule,
    isSupportedTypeScriptSourceModule,
} from "./source-modules";

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const fail = (error: string): Result<never> => ({ ok: false, error });

const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) {
        return error.message;
    }

    return String(error);
};

const isPathWithinRoot = (rootPath: string, candidatePath: string): boolean => {
    const relativePath = relative(rootPath, candidatePath);

    return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
};

const isPathWithinAnyRoot = (roots: string[], candidatePath: string): boolean =>
    roots.some((rootPath) => isPathWithinRoot(rootPath, candidatePath));

const isRelativeImportSpecifier = (specifier: string): boolean => specifier.startsWith("./") || specifier.startsWith("../");
const isLocalFileImportSpecifier = (specifier: string): boolean => specifier.startsWith("file:") || isAbsolute(specifier);
const isPackageImportSpecifier = (specifier: string): boolean => specifier.startsWith("#");
const isIdentifierCharacter = (value: string | undefined): boolean => value !== undefined && /[A-Za-z0-9_$]/.test(value);

const skipQuotedString = (source: string, start: number, quote: "'" | '"'): number => {
    let index = start + 1;

    while (index < source.length) {
        if (source[index] === "\\") {
            index += 2;
            continue;
        }

        if (source[index] === quote) {
            return index + 1;
        }

        index += 1;
    }

    return index;
};

const skipWhitespaceAndComments = (source: string, start: number): number => {
    let index = start;

    while (index < source.length) {
        if (/\s/.test(source[index] ?? "")) {
            index += 1;
            continue;
        }

        if (source[index] === "/" && source[index + 1] === "/") {
            index += 2;
            while (index < source.length && source[index] !== "\n") {
                index += 1;
            }
            continue;
        }

        if (source[index] === "/" && source[index + 1] === "*") {
            index += 2;
            while (index < source.length && !(source[index] === "*" && source[index + 1] === "/")) {
                index += 1;
            }
            index = Math.min(index + 2, source.length);
            continue;
        }

        break;
    }

    return index;
};

const findUnsupportedDynamicImportExpression = (
    source: string,
    start = 0,
    stopCharacter?: string,
): { next: number; unsupported: boolean } => {
    let index = start;

    while (index < source.length) {
        const character = source[index];
        if (stopCharacter !== undefined && character === stopCharacter) {
            return { next: index + 1, unsupported: false };
        }

        if (character === "/" && source[index + 1] === "/") {
            index = skipWhitespaceAndComments(source, index);
            continue;
        }

        if (character === "/" && source[index + 1] === "*") {
            index = skipWhitespaceAndComments(source, index);
            continue;
        }

        if (character === "'" || character === '"') {
            index = skipQuotedString(source, index, character);
            continue;
        }

        if (character === "`") {
            index += 1;
            while (index < source.length) {
                if (source[index] === "\\") {
                    index += 2;
                    continue;
                }

                if (source[index] === "`") {
                    index += 1;
                    break;
                }

                if (source[index] === "$" && source[index + 1] === "{") {
                    const nested = findUnsupportedDynamicImportExpression(source, index + 2, "}");
                    if (nested.unsupported) {
                        return nested;
                    }
                    index = nested.next;
                    continue;
                }

                index += 1;
            }
            continue;
        }

        if (
            source.startsWith("import", index) &&
            !isIdentifierCharacter(source[index - 1]) &&
            !isIdentifierCharacter(source[index + "import".length])
        ) {
            let nextIndex = skipWhitespaceAndComments(source, index + "import".length);
            if (source[nextIndex] === "(") {
                nextIndex = skipWhitespaceAndComments(source, nextIndex + 1);
                const argumentStart = source[nextIndex];

                if (argumentStart === "'" || argumentStart === '"') {
                    index = skipQuotedString(source, nextIndex, argumentStart);
                    continue;
                }

                if (argumentStart === "`") {
                    return { next: nextIndex, unsupported: true };
                }

                return { next: nextIndex, unsupported: true };
            }
        }

        index += 1;
    }

    return { next: index, unsupported: false };
};

export const resolveAppSourceRoot = (
    rootDir: string,
    appComponentPath: string,
    configFileName = CONFIG_FILE_NAME,
): Result<string> => {
    const appComponentRelativeToRoot = relative(rootDir, appComponentPath);
    if (appComponentRelativeToRoot.startsWith("..") || isAbsolute(appComponentRelativeToRoot)) {
        return fail(`Invalid appComponent in ${configFileName}: expected a path inside the project root.`);
    }

    const segments = appComponentRelativeToRoot.split(/[\\/]/).filter((segment) => segment.length > 0);
    const [topLevelDir] = segments;

    if (topLevelDir === undefined || segments.length <= 1) {
        return fail(
            `Invalid appComponent in ${configFileName}: expected a component path inside src/ or another top-level source directory.`,
        );
    }

    return ok(topLevelDir === "src" ? join(rootDir, "src") : join(rootDir, topLevelDir));
};

export const validateResolvedAppComponentPath = (
    rootDir: string,
    appSourceRoot: string,
    resolvedAppComponentPath: string,
    configFileName = CONFIG_FILE_NAME,
): Result<string> => {
    const physicalPath = (() => {
        try {
            return realpathSync(resolvedAppComponentPath);
        } catch (error) {
            return null;
        }
    })();

    if (physicalPath === null) {
        return ok(resolvedAppComponentPath);
    }

    if (!isPathWithinRoot(rootDir, physicalPath) || !isPathWithinRoot(appSourceRoot, physicalPath)) {
        return fail(
            `Invalid appComponent in ${configFileName}: symbolic links must resolve inside the app source tree (${appSourceRoot}).`,
        );
    }

    return ok(resolvedAppComponentPath);
};

const resolveRelativeImportPath = async (specifier: string, importerPath: string): Promise<Result<string>> => {
    const importerUrl = new URL(`file://${importerPath}`);

    return Promise.resolve()
        .then(() => import.meta.resolve(specifier, importerUrl.href))
        .then(
            (resolvedUrl) => {
                if (!resolvedUrl.startsWith("file://")) {
                    return fail(`Unsupported local import in app source tree: ${specifier} from ${importerPath}`);
                }

                return ok(fileURLToPath(resolvedUrl));
            },
            (error) => fail(`Failed to resolve local import ${specifier} from ${importerPath}: ${getErrorMessage(error)}`),
        );
};

const buildImportScanner = new Bun.Transpiler({ loader: "js" });
const buildTypeScriptTranspiler = new Bun.Transpiler({ loader: "ts" });

const loadImportValidationSource = async (path: string): Promise<Result<string>> => {
    const file = Bun.file(path);
    const exists = await file.exists();
    if (!exists) {
        return fail(`Missing file: ${path}`);
    }

    const source = await file.text().then(
        (value) => ok(value),
        (error) => fail(`Failed to read ${path}: ${getErrorMessage(error)}`),
    );
    if (!source.ok) {
        return source;
    }

    if (isSupportedSvelteSourceModule(path)) {
        const compiled = compile(source.value, {
            css: "external",
            filename: path,
            generate: "client",
            modernAst: true,
        });
        return ok(compiled.js.code);
    }

    if (isSupportedTypeScriptSourceModule(path)) {
        return ok(buildTypeScriptTranspiler.transformSync(source.value));
    }

    return ok(source.value);
};

export const validateLocalSourceImportGraph = async (entryPath: string, allowedRoots: string[]): Promise<Result<void>> => {
    const pending = [entryPath];
    const visited = new Set<string>();

    while (pending.length > 0) {
        const currentPath = pending.pop();
        if (currentPath === undefined) {
            break;
        }

        const resolvedCurrentPath = (() => {
            try {
                return realpathSync(currentPath);
            } catch {
                return currentPath;
            }
        })();
        if (visited.has(resolvedCurrentPath)) {
            continue;
        }
        visited.add(resolvedCurrentPath);

        const source = await loadImportValidationSource(currentPath);
        if (!source.ok) {
            return source;
        }

        if (findUnsupportedDynamicImportExpression(source.value).unsupported) {
            return fail(`Dynamic import expressions are not supported in app source tree: ${currentPath}`);
        }

        const specifiers = Array.from(
            new Set(
                buildImportScanner
                    .scanImports(source.value)
                    .map((record) => record.path)
                    .filter(
                        (specifier) =>
                            isRelativeImportSpecifier(specifier) ||
                            isLocalFileImportSpecifier(specifier) ||
                            isPackageImportSpecifier(specifier),
                    ),
            ),
        );

        for (const specifier of specifiers) {
            if (isLocalFileImportSpecifier(specifier)) {
                return fail(`Local import escaped app source tree: ${specifier} from ${currentPath}`);
            }

            if (isPackageImportSpecifier(specifier)) {
                return fail(`App-local package imports are not supported in app source tree: ${specifier} from ${currentPath}`);
            }

            const resolvedImport = await resolveRelativeImportPath(specifier, currentPath);
            if (!resolvedImport.ok) {
                return resolvedImport;
            }

            const resolvedImportPath = (() => {
                try {
                    return realpathSync(resolvedImport.value);
                } catch {
                    return resolvedImport.value;
                }
            })();

            if (!isPathWithinAnyRoot(allowedRoots, resolvedImportPath)) {
                return fail(`Local import escaped app source tree: ${specifier} from ${currentPath}`);
            }

            if (!isSupportedLocalSourceModule(resolvedImport.value)) {
                return fail(
                    `Unsupported local source module in app source tree: ${specifier} from ${currentPath}. Supported module extensions: ${formatSupportedLocalSourceModuleExtensions()}.`,
                );
            }

            pending.push(resolvedImport.value);
        }
    }

    return ok(undefined);
};

const SVELTE_BROWSER_IMPORTS = {
    svelte: "src/index-client.js",
    "svelte/store": "src/store/index-client.js",
    "svelte/legacy": "src/legacy/legacy-client.js",
    "svelte/internal": "src/internal/index.js",
    "svelte/internal/client": "src/internal/client/index.js",
    "svelte/internal/disclose-version": "src/internal/disclose-version.js",
} as const;

const findSveltePackageRoot = (startDir: string): string | null => {
    let currentDir = startDir;

    while (true) {
        const packageJsonPath = join(currentDir, "node_modules", "svelte", "package.json");
        if (existsSync(packageJsonPath)) {
            return dirname(realpathSync(packageJsonPath));
        }

        const parentDir = dirname(currentDir);
        if (parentDir === currentDir) {
            return null;
        }

        currentDir = parentDir;
    }
};

export const resolveSvelteBrowserImportPath = (rootDir: string, specifier: string): string | null => {
    const sveltePackageRoot = findSveltePackageRoot(rootDir);
    if (sveltePackageRoot === null) {
        return null;
    }

    const relativeRuntimePath = SVELTE_BROWSER_IMPORTS[specifier as keyof typeof SVELTE_BROWSER_IMPORTS];
    if (relativeRuntimePath === undefined) {
        return null;
    }

    return join(sveltePackageRoot, relativeRuntimePath);
};

export const validateSvelteBrowserImportAliases = async (rootDir: string): Promise<Result<void>> => {
    const sveltePackageRoot = findSveltePackageRoot(rootDir);
    if (sveltePackageRoot === null) {
        return fail(
            `Svelte runtime alias validation failed for ${rootDir}: unable to locate node_modules/svelte/package.json.`,
        );
    }

    const missingSpecifiers: string[] = [];

    await Promise.all(
        Object.keys(SVELTE_BROWSER_IMPORTS).map(async (specifier) => {
            const resolvedPath = join(
                sveltePackageRoot,
                SVELTE_BROWSER_IMPORTS[specifier as keyof typeof SVELTE_BROWSER_IMPORTS],
            );
            if (!(await Bun.file(resolvedPath).exists())) {
                missingSpecifiers.push(specifier);
            }
        }),
    );

    if (missingSpecifiers.length > 0) {
        return fail(
            `Svelte runtime alias validation failed for ${rootDir}: missing browser runtime files for ${missingSpecifiers.join(", ")}.`,
        );
    }

    return ok(undefined);
};
