#!/usr/bin/env bun

import {
  existsSync,
  lstatSync,
  realpathSync,
  statSync,
} from "node:fs";

import {
  cp,
  mkdir,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";

import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
} from "node:path";

import { fileURLToPath } from "node:url";
import { compile } from "svelte/compiler";
import type { BuildConfig, BunPlugin } from "bun";

import {
  copyConfiguredAssets,
  resolveConfiguredAssetsDirs,
  type ResolvedAssetsDir,
} from "./assets";

import { formatBuildReport } from "./report";
import {
  CONFIG_FILE_NAME,
  defineSvelteConfig,
  loadSvelteConfig,
  validateMountId,
  validateAppComponent,
  resolveAppSourceRoot,
  validateResolvedAppComponentPath,
  type BuildSvelteOptions,
} from "./config";

export {
  defineSvelteConfig,
  loadSvelteConfig,
  validateMountId,
  validateAppComponent,
  resolveAppSourceRoot,
  validateResolvedAppComponentPath,
  CONFIG_FILE_NAME,
  type BuildSvelteOptions,
} from "./config";

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });

export const err = (error: string): Result<never> => ({ ok: false, error });

export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

export const getErrorCode = (error: unknown): string | undefined =>
  error instanceof Error && "code" in error && typeof error.code === "string"
    ? error.code
    : undefined;

export const isPathWithinRoot = (
  rootPath: string,
  candidatePath: string,
): boolean => {
  const relativePath = relative(rootPath, candidatePath);
  return (
    relativePath === "" ||
    (!relativePath.startsWith("..") && !isAbsolute(relativePath))
  );
};

export const isPathWithinAnyRoot = (roots: string[], candidatePath: string): boolean =>
  roots.some((rootPath) => isPathWithinRoot(rootPath, candidatePath));

export const formatBuildLogs = (
  logs: Array<{ message?: string; name?: string }>,
): string => {
  if (logs.length === 0) {
    return "Bun.build failed without diagnostic logs.";
  }
  return logs
    .map((log) => log.message ?? log.name ?? "Unknown build error")
    .join("\n");
};

export const getBuildErrorMessage = (error: unknown): string => {
  if (
    typeof error === "object" &&
    error !== null &&
    "logs" in error &&
    Array.isArray(error.logs)
  ) {
    return formatBuildLogs(
      error.logs as Array<{ message?: string; name?: string }>,
    );
  }
  return error instanceof Error ? error.message : String(error);
};

export const normalizeModulePath = (value: string): string =>
  value.replace(/\\/g, "/");

export const resolveConfiguredPath = (
  rootDir: string,
  value: string | undefined,
  fallback: string,
): string => {
  const target = value ?? fallback;
  return isAbsolute(target) ? target : join(rootDir, target);
};

export const isRelativeImportSpecifier = (specifier: string): boolean =>
  specifier.startsWith("./") || specifier.startsWith("../");

export const isLocalFileImportSpecifier = (specifier: string): boolean =>
  specifier.startsWith("file:") || specifier.startsWith("/");

export const isPackageImportSpecifier = (specifier: string): boolean =>
  specifier.startsWith("#");

export const isIdentifierCharacter = (value: string | undefined): boolean =>
  value !== undefined && /[A-Za-z0-9_$]/.test(value);

export const skipQuotedString = (
  source: string,
  start: number,
  quote: "'" | '"',
): number => {
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

export const skipWhitespaceAndComments = (
  source: string,
  start: number,
): number => {
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
      while (
        index < source.length &&
        !(source[index] === "*" && source[index + 1] === "/")
      ) {
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
          const nested = findUnsupportedDynamicImportExpression(
            source,
            index + 2,
            "}",
          );
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
      let nextIndex = skipWhitespaceAndComments(
        source,
        index + "import".length,
      );
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

export const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const SUPPORTED_LOCAL_SOURCE_MODULE_EXTENSIONS = [
  ".svelte",
  ".ts",
  ".js",
  ".mjs",
] as const;
const isTypeScriptDeclarationFile = (path: string): boolean =>
  path.endsWith(".d.ts");

export const formatSupportedLocalSourceModuleExtensions = (): string =>
  SUPPORTED_LOCAL_SOURCE_MODULE_EXTENSIONS.join(", ");

const JS_EXTENSIONS = [".js", ".mjs"] as const;

export const isSupportedJavaScriptSourceModule = (path: string): boolean =>
  JS_EXTENSIONS.some((ext) => path.endsWith(ext));

export const isSupportedLocalSourceModule = (path: string): boolean =>
  !isTypeScriptDeclarationFile(path) &&
  SUPPORTED_LOCAL_SOURCE_MODULE_EXTENSIONS.some((extension) =>
    path.endsWith(extension),
  );

export const isSupportedSvelteSourceModule = (path: string): boolean =>
  path.endsWith(".svelte");

export const isSupportedTypeScriptSourceModule = (path: string): boolean =>
  path.endsWith(".ts") && !isTypeScriptDeclarationFile(path);

export type SvelteDiagnosticsKind = "errors" | "warnings";

export const stripSvelteDiagnosticsModule = (
  source: string,
  kind: SvelteDiagnosticsKind,
): string => {
  const exportStarStatements = Array.from(
    source.matchAll(/^\s*export\s+\*\s+from\s+['"][^'"]+['"];\s*$/gm),
  );
  const exportedFunctions = Array.from(
    source.matchAll(/export function\s+(\w+)\s*\(([^)]*)\)\s*\{/g),
  );
  const exportStatements = Array.from(
    source.matchAll(/^\s*export\s+/gm),
  ).length;
  const supportedExportStatements =
    exportStarStatements.length + exportedFunctions.length;

  if (
    exportedFunctions.length === 0 ||
    supportedExportStatements !== exportStatements
  ) {
    throw new Error(
      `Unsupported Svelte ${kind} module shape for diagnostics stripping`,
    );
  }

  return [
    ...exportStarStatements.map(([statement]) => statement.trim()),
    ...exportedFunctions.map(([, name, args]) => {
      const statement =
        kind === "errors"
          ? `throw Error(${JSON.stringify(name)});`
          : `console.warn(${JSON.stringify(name)});`;
      return `export function ${name}(${args}) { ${statement} }`;
    }),
  ].join("\n");
};

export const createImportPath = (fromDir: string, toPath: string): string => {
  const importPath = normalizeModulePath(relative(fromDir, toPath));

  return importPath.startsWith(".") ? importPath : `./${importPath}`;
};

export const createBootstrapSource = (
  appComponentImportPath = "./src/App.svelte",
  mountId = "app",
): string =>
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

export const createBootstrapModuleSource = createBootstrapSource;

type RuntimeElement = { id: string };

export type RuntimeMountScope = {
  getElementById: (id: string) => RuntimeElement | null;
};

const normalizeMountId = (mountId: string): string => mountId.trim();

const isValidMountId = (mountId: string): boolean =>
  !/\s/u.test(mountId) && !mountId.startsWith("#");

// Type-only export for editor/type-checker consumers.
// Build/dev replace this module with a generated runtime module that embeds the configured mount id.
export declare const mountId: string;

export const getMountTarget = (
  scope: RuntimeMountScope,
  mountId: string,
): RuntimeElement => {
  const normalizedMountId = normalizeMountId(mountId);
  const target = scope.getElementById(normalizedMountId);
  if (!target) {
    throw new Error(`Missing mount id: ${normalizedMountId}`);
  }

  return target;
};

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

const resolveRelativeImportPath = async (
  specifier: string,
  importerPath: string,
): Promise<Result<string>> => {
  const importerUrl = new URL(`file://${importerPath}`);

  return Promise.resolve()
    .then(() => import.meta.resolve(specifier, importerUrl.href))
    .then(
      (resolvedUrl) => {
        if (!resolvedUrl.startsWith("file://")) {
          return err(
            `Unsupported local import in app source tree: ${specifier} from ${importerPath}`,
          );
        }

        return ok(fileURLToPath(resolvedUrl));
      },
      (error) =>
        err(
          `Failed to resolve local import ${specifier} from ${importerPath}: ${getErrorMessage(error)}`,
        ),
    );
};

const buildImportScanner = new Bun.Transpiler({ loader: "js" });
const buildTypeScriptTranspiler = new Bun.Transpiler({ loader: "ts" });

const loadImportValidationSource = async (
  path: string,
): Promise<Result<string>> => {
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

  if (isSupportedTypeScriptSourceModule(path)) {
    return ok(buildTypeScriptTranspiler.transformSync(source.value));
  }

  return ok(source.value);
};

export const validateLocalSourceImportGraph = async (
  entryPath: string,
  allowedRoots: string[],
): Promise<Result<void>> => {
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
      return err(
        `Dynamic import expressions are not supported in app source tree: ${currentPath}`,
      );
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
        return err(
          `Local import escaped app source tree: ${specifier} from ${currentPath}`,
        );
      }

      if (isPackageImportSpecifier(specifier)) {
        return err(
          `App-local package imports are not supported in app source tree: ${specifier} from ${currentPath}`,
        );
      }

      const resolvedImport = await resolveRelativeImportPath(
        specifier,
        currentPath,
      );
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
        return err(
          `Local import escaped app source tree: ${specifier} from ${currentPath}`,
        );
      }

      if (!isSupportedLocalSourceModule(resolvedImport.value)) {
        return err(
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
    const packageJsonPath = join(
      currentDir,
      "node_modules",
      "svelte",
      "package.json",
    );
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

export const resolveSvelteBrowserImportPath = (
  rootDir: string,
  specifier: string,
): string | null => {
  const sveltePackageRoot = findSveltePackageRoot(rootDir);
  if (sveltePackageRoot === null) {
    return null;
  }

  const relativeRuntimePath =
    SVELTE_BROWSER_IMPORTS[specifier as keyof typeof SVELTE_BROWSER_IMPORTS];
  if (relativeRuntimePath === undefined) {
    return null;
  }

  return join(sveltePackageRoot, relativeRuntimePath);
};

export const validateSvelteBrowserImportAliases = async (
  rootDir: string,
): Promise<Result<void>> => {
  const sveltePackageRoot = findSveltePackageRoot(rootDir);
  if (sveltePackageRoot === null) {
    return err(
      `Svelte runtime alias validation failed for ${rootDir}: unable to locate node_modules/svelte/package.json.`,
    );
  }

  const missingSpecifiers: string[] = [];

  await Promise.all(
    Object.keys(SVELTE_BROWSER_IMPORTS).map(async (specifier) => {
      const resolvedPath = join(
        sveltePackageRoot,
        SVELTE_BROWSER_IMPORTS[
          specifier as keyof typeof SVELTE_BROWSER_IMPORTS
        ],
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

const createScopedCssClassName = (
  css: string,
  hash: (input: string) => string,
): string => `_${hash(css)}`;

const readRequiredText = async (path: string): Promise<Result<string>> => {
  const file = Bun.file(path);
  const exists = await file.exists();
  if (!exists) return err(`Missing file: ${path}`);

  return file.text().then(
    (value) => ok(value),
    (error) => err(`Failed to read ${path}: ${getErrorMessage(error)}`),
  );
};

const compileSvelteModule = async (
  path: string,
): Promise<Result<{ css: string; js: string }>> => {
  const source = await readRequiredText(path);
  if (!source.ok) return source;

  return Promise.resolve()
    .then(() =>
      compile(source.value, {
        css: "external",
        cssHash: ({ css, hash }) => createScopedCssClassName(css, hash),
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

export const createProductionEsmEnvPlugin = (): BunPlugin => ({
  name: "production-esm-env-plugin",
  target: "browser",
  setup: (builder) => {
    builder.onResolve({ filter: /^esm-env\/development$/ }, () => ({
      namespace: "svelte-builder-virtual",
      path: "esm-env/development",
    }));

    builder.onLoad(
      { filter: /^esm-env\/development$/, namespace: "svelte-builder-virtual" },
      () => ({
        contents: "export default false;",
        loader: "js",
      }),
    );

    builder.onLoad(
      { filter: /internal\/(?:client|shared)\/errors\.js$/ },
      async ({ path }) => ({
        contents: stripSvelteDiagnosticsModule(
          await Bun.file(path).text(),
          "errors",
        ),
        loader: "js",
      }),
    );

    builder.onLoad(
      { filter: /internal\/(?:client|shared)\/warnings\.js$/ },
      async ({ path }) => ({
        contents: stripSvelteDiagnosticsModule(
          await Bun.file(path).text(),
          "warnings",
        ),
        loader: "js",
      }),
    );
  },
});

export const createSvelteRuntimeAliasPlugin = (rootDir: string): BunPlugin => ({
  name: "svelte-runtime-alias-plugin",
  target: "browser",
  setup: (builder) => {
    builder.onResolve({ filter: /^svelte(?:\/.*)?$/ }, ({ path }) => {
      const resolvedPath = resolveSvelteBrowserImportPath(rootDir, path);
      if (resolvedPath === null) return null;

      return { path: resolvedPath };
    });
  },
});

export const createSveltePlugin = (
  cssByPath: Map<string, string>,
): BunPlugin => ({
  name: "svelte-prod-plugin",
  target: "browser",
  setup: (builder) => {
    builder.onLoad({ filter: /\.svelte$/ }, async ({ path }) => {
      const compiled = await compileSvelteModule(path);
      if (!compiled.ok) return Promise.reject(new Error(compiled.error));

      if (compiled.value.css.length > 0) {
        cssByPath.set(path, compiled.value.css);
      }

      return { contents: compiled.value.js, loader: "js" };
    });
  },
});

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

export const DEFAULT_HTML_SHELL: HtmlShell = {
  appHtml: '<main id="app"></main>',
  lang: "en",
  title: "Svelte Builder",
};

const createContentHash = (content: string, length: number): string =>
  new Bun.CryptoHasher("sha256").update(content).digest("hex").slice(0, length);

const minifyCss = async (content: string): Promise<string> => {
  const tempFile = join("/tmp", `svelte-lib-css-${Math.random().toString(36).slice(2)}.css`);
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
    await rm(tempFile, { force: true }).catch(() => undefined);
  }
};

const validateOutDir = (
  rootDir: string,
  outDir: string,
  appSourceRoot: string,
): Result<string> => {
  if (!isPathWithinRoot(rootDir, outDir) || outDir === rootDir) {
    return err(
      `Invalid outDir in ${CONFIG_FILE_NAME}: expected a dedicated build output directory inside the project root.`,
    );
  }

  if (
    isPathWithinRoot(outDir, appSourceRoot) ||
    isPathWithinRoot(appSourceRoot, outDir)
  ) {
    return err(
      `Invalid outDir in ${CONFIG_FILE_NAME}: outDir must not overlap the app source tree.`,
    );
  }

  return ok(outDir);
};

export const createHtmlShell = (
  mountId: string,
  appTitle = DEFAULT_HTML_SHELL.title,
): HtmlShell => ({
  appHtml: `<main id="${escapeHtml(mountId)}"></main>`,
  lang: "en",
  title: appTitle,
});

const prepareDir = async (path: string): Promise<Result<string>> =>
  mkdir(path, { recursive: true }).then(
    () => ok(path),
    (error) => err(`Failed to create ${path}: ${getErrorMessage(error)}`),
  );

const writeIndexHtml = async (
  outDir: string,
  shell: HtmlShell,
  jsFile: string,
  cssFile: string,
): Promise<Result<string>> => {
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

const resolveBuildContext = async (
  rootDir: string,
  options: BuildSvelteOptions,
): Promise<Result<BuildContext>> => {
  const outDirRaw = resolveConfiguredPath(rootDir, options.outDir, "dist");
  const mountId = validateMountId(options.mountId, "mountId");
  if (!mountId.ok) return mountId;
  const appComponent = validateAppComponent(
    options.appComponent,
    "appComponent",
  );
  if (!appComponent.ok) return appComponent;
  const appComponentPath = resolveConfiguredPath(
    rootDir,
    appComponent.value,
    "src/App.svelte",
  );
  const appSourceRoot = resolveAppSourceRoot(rootDir, appComponentPath);
  if (!appSourceRoot.ok) return appSourceRoot;
  const assetsDirs = await resolveConfiguredAssetsDirs(
    rootDir,
    options.assetsDirs,
    "assets",
  );
  if (!assetsDirs.ok) return assetsDirs;

  const validatedOutDir = validateOutDir(
    rootDir,
    outDirRaw,
    appSourceRoot.value,
  );
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
  if (!entryExists)
    return err(`Missing SPA app component: ${ctx.appComponentPath}`);

  const validatedPath = validateResolvedAppComponentPath(
    ctx.rootDir,
    ctx.appSourceRoot,
    ctx.appComponentPath,
  );
  if (!validatedPath.ok) return validatedPath;

  const validatedGraph = await validateLocalSourceImportGraph(
    ctx.appComponentPath,
    [realpathSync(ctx.appSourceRoot)],
  );
  if (!validatedGraph.ok) return validatedGraph;

  const validatedAliases = await validateSvelteBrowserImportAliases(
    ctx.rootDir,
  );
  if (!validatedAliases.ok) return validatedAliases;

  return ok(undefined);
};

export const buildSvelte = async (
  options: BuildSvelteOptions = {},
): Promise<Result<BuildArtifacts>> => {
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
  const bootstrapSource = createBootstrapSource(
    createImportPath(ctx.value.rootDir, ctx.value.appComponentPath),
    ctx.value.mountId,
  );
  const stageDir = join(ctx.value.rootDir, `.bsp-stage-${Date.now()}`);
  await mkdir(stageDir, { recursive: true });
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
      createSveltePlugin(cssByPath),
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
  const entryOutput = outputs.find(
    (o) => o.kind === "entry-point" && o.path.endsWith(".js"),
  );
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
  await writeIndexHtml(
    ctx.value.outDir,
    createHtmlShell(ctx.value.mountId, ctx.value.appTitle),
    entryFile,
    cssFile,
  );

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
};

export const runConfiguredBuild = async (
  cwd = process.cwd(),
): Promise<Result<BuildArtifacts>> => {
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
