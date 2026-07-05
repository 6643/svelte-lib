import { existsSync, realpathSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { compile, compileModule } from "svelte/compiler";
import type { BunPlugin } from "bun";

import { err, getErrorMessage, isPathWithinAnyRoot, normalizeModulePath, ok, type Result } from "./utils";

export const isRelativeImportSpecifier = (specifier: string): boolean =>
    specifier.startsWith("./") || specifier.startsWith("../");

export const isLocalFileImportSpecifier = (specifier: string): boolean =>
    specifier.startsWith("file:") || specifier.startsWith("/");

export const isPackageImportSpecifier = (specifier: string): boolean => specifier.startsWith("#");

export const isIdentifierCharacter = (value: string | undefined): boolean => value !== undefined && /[A-Za-z0-9_$]/.test(value);

export const skipQuotedString = (source: string, start: number, quote: "'" | '"'): number => {
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

export const skipWhitespaceAndComments = (source: string, start: number): number => {
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

export const findUnsupportedDynamicImportExpression = (
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

                return { next: nextIndex, unsupported: true };
            }
        }

        index += 1;
    }

    return { next: index, unsupported: false };
};

export const escapeHtml = (value: string): string =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const SUPPORTED_LOCAL_SOURCE_MODULE_EXTENSIONS = [".svelte", ".svelte.ts", ".svelte.js", ".ts", ".js", ".mjs"] as const;

const isTypeScriptDeclarationFile = (path: string): boolean => path.endsWith(".d.ts");

export const formatSupportedLocalSourceModuleExtensions = (): string => SUPPORTED_LOCAL_SOURCE_MODULE_EXTENSIONS.join(", ");

const JS_EXTENSIONS = [".js", ".mjs"] as const;

export const isSupportedSvelteRunesSourceModule = (path: string): boolean =>
    path.endsWith(".svelte.ts") || path.endsWith(".svelte.js");

export const isSupportedJavaScriptSourceModule = (path: string): boolean =>
    !isSupportedSvelteRunesSourceModule(path) && JS_EXTENSIONS.some((ext) => path.endsWith(ext));

export const isSupportedLocalSourceModule = (path: string): boolean =>
    !isTypeScriptDeclarationFile(path) &&
    SUPPORTED_LOCAL_SOURCE_MODULE_EXTENSIONS.some((extension) => path.endsWith(extension));

export const isSupportedSvelteSourceModule = (path: string): boolean => path.endsWith(".svelte");

export const isSupportedTypeScriptSourceModule = (path: string): boolean =>
    !isSupportedSvelteRunesSourceModule(path) && path.endsWith(".ts") && !isTypeScriptDeclarationFile(path);

export type SvelteDiagnosticsKind = "errors" | "warnings";

export const stripSvelteDiagnosticsModule = (source: string, kind: SvelteDiagnosticsKind): string => {
    const exportStarStatements = Array.from(source.matchAll(/^\s*export\s+\*\s+from\s+['"][^'"]+['"];\s*$/gm));
    const exportedFunctions = Array.from(source.matchAll(/export function\s+(\w+)\s*\(([^)]*)\)\s*\{/g));
    const exportStatements = Array.from(source.matchAll(/^\s*export\s+/gm)).length;
    const supportedExportStatements = exportStarStatements.length + exportedFunctions.length;

    if (exportedFunctions.length === 0 || supportedExportStatements !== exportStatements) {
        throw new Error(`Unsupported Svelte ${kind} module shape for diagnostics stripping`);
    }

    return [
        ...exportStarStatements.map(([statement]) => statement.trim()),
        ...exportedFunctions.map(([, name, args]) => {
            const statement =
                kind === "errors" ? `throw Error(${JSON.stringify(name)});` : `console.warn(${JSON.stringify(name)});`;
            return `export function ${name}(${args}) { ${statement} }`;
        }),
    ].join("\n");
};

export const createImportPath = (fromDir: string, toPath: string): string => {
    const importPath = normalizeModulePath(relative(fromDir, toPath));
    return importPath.startsWith(".") ? importPath : `./${importPath}`;
};

export const createBootstrapSource = (appComponentImportPath = "./src/App.svelte", mountId = "app"): string =>
    [
        'import { mount } from "svelte";',
        `import App from ${JSON.stringify(normalizeModulePath(appComponentImportPath))};`,
        "",
        `const target = document.getElementById(${JSON.stringify(mountId)});`,
        "if (target === null) {",
        `    throw new Error(${JSON.stringify(`Missing mount target: #${mountId}`)});`,
        "}",
        "",
        "mount(App, {",
        "    target,",
        "});",
    ].join("\n");

type RuntimeElement = { id: string };

type RuntimeMountScope = {
    getElementById: (id: string) => RuntimeElement | null;
};

const normalizeMountId = (mountId: string): string => mountId.trim();

const isValidMountId = (mountId: string): boolean => !/\s/u.test(mountId) && !mountId.startsWith("#");

export const createRuntimeModuleSource = (mountId: string): string => {
    const normalizedMountId = normalizeMountId(mountId);
    if (!isValidMountId(normalizedMountId)) {
        throw new Error(`Invalid mount id for runtime module: ${mountId}`);
    }

    return [
        `export const mountId = ${JSON.stringify(normalizedMountId)};`,
        "export const getMountTarget = (scope = document) => {",
        "    const target = scope.getElementById(mountId);",
        "    if (!target) {",
        "        throw new Error(`Missing mount id: ${mountId}`);",
        "    }",
        "    return target;",
        "};",
    ].join("\n");
};

const resolveRelativeImportPath = async (specifier: string, importerPath: string): Promise<Result<string>> => {
    const importerUrl = new URL(`file://${importerPath}`);

    return Promise.resolve()
        .then(() => import.meta.resolve(specifier, importerUrl.href))
        .then(
            (resolvedUrl) => {
                if (!resolvedUrl.startsWith("file://")) {
                    return err(`Unsupported local import in app source tree: ${specifier} from ${importerPath}`);
                }

                return ok(fileURLToPath(resolvedUrl));
            },
            (error) => err(`Failed to resolve local import ${specifier} from ${importerPath}: ${getErrorMessage(error)}`),
        );
};

const buildImportScanner = new Bun.Transpiler({ loader: "js" });
const buildTypeScriptTranspiler = new Bun.Transpiler({ loader: "ts" });

const prepareSvelteRunesSource = (path: string, source: string): string => {
    if (!path.endsWith(".svelte.ts")) return source;
    return buildTypeScriptTranspiler.transformSync(source);
};

const loadImportValidationSource = async (path: string): Promise<Result<string>> => {
    const file = Bun.file(path);
    const exists = await file.exists();
    if (!exists) {
        return err(`Missing file: ${path}`);
    }

    const source = await file.text().then(
        (value) => ok(value),
        (error) => err(`Failed to read ${path}: ${getErrorMessage(error)}`),
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

    if (isSupportedSvelteRunesSourceModule(path)) {
        const compiled = compileModule(prepareSvelteRunesSource(path, source.value), {
            filename: path,
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
            return err(`Dynamic import expressions are not supported in app source tree: ${currentPath}`);
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
                return err(`Local import escaped app source tree: ${specifier} from ${currentPath}`);
            }

            if (isPackageImportSpecifier(specifier)) {
                return err(`App-local package imports are not supported in app source tree: ${specifier} from ${currentPath}`);
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
                return err(`Local import escaped app source tree: ${specifier} from ${currentPath}`);
            }

            if (!isSupportedLocalSourceModule(resolvedImportPath)) {
                return err(
                    `Unsupported local source module in app source tree: ${specifier} from ${currentPath}. Supported module extensions: ${formatSupportedLocalSourceModuleExtensions()}.`,
                );
            }

            pending.push(resolvedImportPath);
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
        return err(`Svelte runtime alias validation failed for ${rootDir}: unable to locate node_modules/svelte/package.json.`);
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
        return err(
            `Svelte runtime alias validation failed for ${rootDir}: missing browser runtime files for ${missingSpecifiers.join(", ")}.`,
        );
    }

    return ok(undefined);
};

export const createProductionEsmEnvPlugin = (): BunPlugin => ({
    name: "production-esm-env-plugin",
    target: "browser",
    setup: (builder) => {
        builder.onResolve({ filter: /^esm-env\/development$/ }, () => ({
            namespace: "svelte-builder-virtual",
            path: "esm-env/development",
        }));

        builder.onLoad({ filter: /^esm-env\/development$/, namespace: "svelte-builder-virtual" }, () => ({
            contents: "export default false;",
            loader: "js",
        }));

        builder.onLoad({ filter: /internal\/(?:client|shared)\/errors\.js$/ }, async ({ path }) => ({
            contents: stripSvelteDiagnosticsModule(await Bun.file(path).text(), "errors"),
            loader: "js",
        }));

        builder.onLoad({ filter: /internal\/(?:client|shared)\/warnings\.js$/ }, async ({ path }) => ({
            contents: stripSvelteDiagnosticsModule(await Bun.file(path).text(), "warnings"),
            loader: "js",
        }));
    },
});

export const createSvelteRuntimeAliasPlugin = (rootDir: string): BunPlugin => ({
    name: "svelte-runtime-alias-plugin",
    target: "browser",
    setup: (builder) => {
        builder.onResolve({ filter: /^svelte(?:\/.*)?$/ }, ({ path }) => {
            const resolvedPath = resolveSvelteBrowserImportPath(rootDir, path);
            if (resolvedPath === null) {
                return null;
            }

            return { path: resolvedPath };
        });
    },
});

export const createSveltePlugin = (
    cssByPath: Map<string, string>,
    compileSvelteModule: (path: string) => Promise<Result<{ css: string; js: string }>>,
): BunPlugin => ({
    name: "svelte-prod-plugin",
    target: "browser",
    setup: (builder) => {
        builder.onLoad({ filter: /\.svelte\.(?:ts|js)$/ }, async ({ path }) => {
            const compiled = compileModule(prepareSvelteRunesSource(path, await Bun.file(path).text()), {
                filename: path,
            });
            return { contents: compiled.js.code, loader: "js" };
        });

        builder.onLoad({ filter: /\.svelte$/ }, async ({ path }) => {
            const compiled = await compileSvelteModule(path);
            if (!compiled.ok) {
                return Promise.reject(new Error(compiled.error));
            }

            if (compiled.value.css.length > 0) {
                cssByPath.set(path, compiled.value.css);
            }

            return { contents: compiled.value.js, loader: "js" };
        });
    },
});
