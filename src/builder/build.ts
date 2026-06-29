#!/usr/bin/env bun

import {
  existsSync,
  lstatSync,
  realpathSync,
  readdirSync,
  statSync,
} from "node:fs";

import {
  cp,
  mkdir,
  readFile,
  readdir,
  rename,
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

import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { compile } from "svelte/compiler";
import type { BuildArtifact, BuildConfig, BunPlugin } from "bun";

import {
  copyConfiguredAssets,
  resolveConfiguredAssetsDirs,
  type ResolvedAssetsDir,
} from "./assets";

import { finalizeMergedCssAsset } from "./assets";

import { finalizeJavaScriptAssets, type FinalJavaScriptAsset } from "./assets";

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

const isPathWithinAnyRoot = (roots: string[], candidatePath: string): boolean =>
  roots.some((rootPath) => isPathWithinRoot(rootPath, candidatePath));

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

const STAGE_OUTDIR_NAME = ".bsp-stage";
const TEMP_OUTDIR_NAME = "bsp-out";
const RELEASES_DIR_NAME = ".bsp-releases";
const PUBLISH_PATH_HASH_HEX_LENGTH = 8;

const createPathHash = (content: string): string =>
  new Bun.CryptoHasher("sha256")
    .update(content)
    .digest("hex")
    .slice(0, PUBLISH_PATH_HASH_HEX_LENGTH);

const createStageDirPrefix = (rootDir: string, outDir: string): string =>
  `${STAGE_OUTDIR_NAME}-${createPathHash(relative(rootDir, outDir).replace(/\\/g, "/"))}`;

const createPublishLockPath = (outDir: string): string => `${outDir}.lock`;

const createPendingPublishLockPath = (outDir: string, nonce: string): string =>
  join(dirname(outDir), `.${basename(outDir)}.lock-${nonce}`);

const createRollbackOutDirPrefix = (outDir: string): string =>
  `.${basename(outDir)}.rollback-`;

const createRollbackOutDir = (outDir: string, nonce: string): string =>
  join(dirname(outDir), `${createRollbackOutDirPrefix(outDir)}${nonce}`);

const createPublishLockOwnerPath = (lockPath: string): string =>
  join(lockPath, "owner.json");

const isPidAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ESRCH") {
      return false;
    }

    return true;
  }
};

const resolveLegacyReleaseTarget = (
  rootDir: string,
  outDir: string,
): string | undefined => {
  const releasesDir = join(rootDir, RELEASES_DIR_NAME);

  try {
    if (!lstatSync(outDir).isSymbolicLink()) {
      return undefined;
    }

    const resolvedOutDir = realpathSync(outDir);
    if (
      !isPathWithinRoot(releasesDir, resolvedOutDir) ||
      resolvedOutDir === releasesDir
    ) {
      return undefined;
    }

    return resolvedOutDir;
  } catch {
    return undefined;
  }
};

const cleanupLegacyReleaseTarget = async (
  rootDir: string,
  releaseTarget: string | undefined,
): Promise<void> => {
  if (releaseTarget === undefined) {
    return;
  }

  await rm(releaseTarget, { force: true, recursive: true }).catch(
    () => undefined,
  );

  const releasesDir = join(rootDir, RELEASES_DIR_NAME);
  await readdir(releasesDir)
    .then(async (entries) => {
      if (entries.length === 0) {
        await rm(releasesDir, { force: true, recursive: true }).catch(
          () => undefined,
        );
      }
    })
    .catch(() => undefined);
};

const pathExists = (path: string): boolean => {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
};

const cleanupRecoveredRollbackOutDirs = async (
  outDir: string,
): Promise<void> => {
  const rollbackPrefix = createRollbackOutDirPrefix(outDir);
  const outDirParent = dirname(outDir);

  const getMtime = (path: string): number => {
    try {
      return lstatSync(path).mtimeMs;
    } catch {
      return 0;
    }
  };

  const rollbackDirs = await readdir(outDirParent)
    .then((entries: string[]) =>
      entries
        .filter((entry) => entry.startsWith(rollbackPrefix))
        .map((entry) => join(outDirParent, entry))
        .sort((left, right) => getMtime(right) - getMtime(left)),
    )
    .catch(() => []);

  if (rollbackDirs.length === 0) {
    return;
  }

  if (!pathExists(outDir)) {
    const [restoreDir, ...staleDirs] = rollbackDirs;
    if (restoreDir !== undefined) {
      await rename(restoreDir, outDir).catch(() => undefined);
    }

    await Promise.all(
      staleDirs.map((dir) =>
        rm(dir, { force: true, recursive: true }).catch(() => undefined),
      ),
    );
    return;
  }

  await Promise.all(
    rollbackDirs.map((dir) =>
      rm(dir, { force: true, recursive: true }).catch(() => undefined),
    ),
  );
};

const cleanupRecoveredBuildState = async (
  rootDir: string,
  outDir: string,
): Promise<void> => {
  await cleanupLegacyReleaseTarget(
    rootDir,
    resolveLegacyReleaseTarget(rootDir, outDir),
  );
  await cleanupRecoveredRollbackOutDirs(outDir);

  await readdir(rootDir)
    .then((entries: string[]) =>
      Promise.all(
        entries
          .filter((entry) =>
            entry.startsWith(`${createStageDirPrefix(rootDir, outDir)}-`),
          )
          .map((entry) =>
            rm(join(rootDir, entry), { force: true, recursive: true }).catch(
              () => undefined,
            ),
          ),
      ),
    )
    .catch(() => undefined);

  await readdir(dirname(outDir))
    .then((entries: string[]) =>
      Promise.all(
        entries
          .filter((entry) =>
            entry.startsWith(`.${basename(outDir)}.${TEMP_OUTDIR_NAME}-`),
          )
          .map((entry) =>
            rm(join(dirname(outDir), entry), {
              force: true,
              recursive: true,
            }).catch(() => undefined),
          ),
      ),
    )
    .catch(() => undefined);

  await readdir(dirname(outDir))
    .then((entries: string[]) =>
      Promise.all(
        entries
          .filter((entry) => entry.startsWith(`.${basename(outDir)}.lock-`))
          .map((entry) =>
            rm(join(dirname(outDir), entry), {
              force: true,
              recursive: true,
            }).catch(() => undefined),
          ),
      ),
    )
    .catch(() => undefined);
};

export const createBuildNonce = (): string => randomUUID().replace(/-/g, "");

export const createStageDir = (
  rootDir: string,
  outDir: string,
  nonce: string,
): string => join(rootDir, `${createStageDirPrefix(rootDir, outDir)}-${nonce}`);

export const createTempOutDir = (outDir: string, nonce: string): string =>
  join(dirname(outDir), `.${basename(outDir)}.${TEMP_OUTDIR_NAME}-${nonce}`);

export const acquirePublishLock = async (
  rootDir: string,
  outDir: string,
  allowRetry = true,
): Promise<Result<string>> => {
  const lockPath = createPublishLockPath(outDir);
  const pendingLockPath = createPendingPublishLockPath(
    outDir,
    createBuildNonce(),
  );
  const ownerPath = createPublishLockOwnerPath(lockPath);
  const pendingOwnerPath = createPublishLockOwnerPath(pendingLockPath);

  const pendingLockReady = await mkdir(pendingLockPath).then(
    () => ok(pendingLockPath),
    (error) =>
      err(
        `Failed to create pending build lock ${pendingLockPath}: ${getErrorMessage(error)}`,
      ),
  );
  if (!pendingLockReady.ok) {
    return pendingLockReady;
  }

  const pendingOwnerWritten = await writeFile(
    pendingOwnerPath,
    JSON.stringify({ pid: process.pid }),
    "utf8",
  ).then(
    () => ok(pendingOwnerPath),
    (error) =>
      err(
        `Failed to write build lock owner ${pendingOwnerPath}: ${getErrorMessage(error)}`,
      ),
  );
  if (!pendingOwnerWritten.ok) {
    await rm(pendingLockPath, { force: true, recursive: true }).catch(
      () => undefined,
    );
    return pendingOwnerWritten;
  }

  return rename(pendingLockPath, lockPath).then(
    () => ok(lockPath),
    async (error: unknown) => {
      await rm(pendingLockPath, { force: true, recursive: true }).catch(
        () => undefined,
      );

      if (
        !(error instanceof Error) ||
        !("code" in error) ||
        (error.code !== "EEXIST" && error.code !== "ENOTEMPTY")
      ) {
        return err(
          `Failed to acquire build lock ${lockPath}: ${getErrorMessage(error)}`,
        );
      }

      const owner = await readFile(ownerPath, "utf8").then(
        (value) =>
          Promise.resolve(value)
            .then((text: string) => JSON.parse(text) as { pid?: unknown })
            .then(
              (parsed) =>
                typeof parsed.pid === "number"
                  ? ok<number | null>(parsed.pid)
                  : ok<number | null>(null),
              () => ok<number | null>(null),
            ),
        () => ok<number | null>(null),
      );
      if (!owner.ok) {
        return owner;
      }

      if (owner.value !== null && isPidAlive(owner.value)) {
        return err(
          `Another build is already running for ${outDir} (pid ${owner.value}).`,
        );
      }

      if (!allowRetry) {
        return err(`Failed to recover stale build lock ${lockPath}.`);
      }

      await rm(lockPath, { force: true, recursive: true }).catch(
        () => undefined,
      );
      await cleanupRecoveredBuildState(rootDir, outDir);
      return acquirePublishLock(rootDir, outDir, false);
    },
  );
};

export const publishBuildOutput = async (
  rootDir: string,
  tempOutDir: string,
  outDir: string,
): Promise<Result<string>> => {
  const legacyReleaseTarget = resolveLegacyReleaseTarget(rootDir, outDir);
  const rollbackOutDir = createRollbackOutDir(outDir, createBuildNonce());
  let movedExistingOutDir = false;

  const movedExisting = await rename(outDir, rollbackOutDir).then(
    () => {
      movedExistingOutDir = true;
      return ok<void>(undefined);
    },
    (error: unknown) => {
      if (getErrorCode(error) === "ENOENT") {
        return ok<void>(undefined);
      }

      return err(
        `Failed to prepare ${outDir} for publish: ${getErrorMessage(error)}`,
      );
    },
  );
  if (!movedExisting.ok) {
    return movedExisting;
  }

  const published = await rename(tempOutDir, outDir).then(
    () => ok(outDir),
    (error) => err(`Failed to publish ${outDir}: ${getErrorMessage(error)}`),
  );
  if (!published.ok) {
    if (movedExistingOutDir) {
      const restored = await rename(rollbackOutDir, outDir).then(
        () => ok(outDir),
        (error) =>
          err(
            `Failed to restore previous output for ${outDir}: ${getErrorMessage(error)}`,
          ),
      );
      if (!restored.ok) {
        return err(`${published.error} ${restored.error}`);
      }
    }

    return published;
  }

  if (movedExistingOutDir) {
    await rm(rollbackOutDir, { force: true, recursive: true }).catch(
      () => undefined,
    );
  }
  await cleanupLegacyReleaseTarget(rootDir, legacyReleaseTarget);
  return published;
};

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
const FINAL_HASH_HEX_LENGTH = 8;
const MAX_JS_HASH_STABILIZATION_PASSES = 32;

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

const createHex16Hash = (content: string): string =>
  new Bun.CryptoHasher("sha256")
    .update(content)
    .digest("hex")
    .slice(0, FINAL_HASH_HEX_LENGTH);

const createFinalAssetFile = (
  content: string,
  extension: ".css" | ".js",
): string => `${createHex16Hash(content)}${extension}`;

const prepareDir = async (path: string): Promise<Result<string>> => {
  const cleared = await rm(path, { force: true, recursive: true }).then(
    () => ok(path),
    (error) => err(`Failed to clear ${path}: ${getErrorMessage(error)}`),
  );
  if (!cleared.ok) {
    return cleared;
  }

  return mkdir(path, { recursive: true }).then(
    () => ok(path),
    (error) => err(`Failed to create ${path}: ${getErrorMessage(error)}`),
  );
};

const writeJavaScriptAssets = async (
  outDir: string,
  assets: FinalJavaScriptAsset[],
): Promise<Result<void>> => {
  const writes = Array.from(
    new Map(assets.map((asset) => [asset.finalFile, asset.content])).entries(),
    ([finalFile, content]) =>
      writeFile(join(outDir, finalFile), content, "utf8"),
  );

  return Promise.all(writes).then(
    () => ok(undefined),
    (error) =>
      err(`Failed to write JavaScript assets: ${getErrorMessage(error)}`),
  );
};

const writeCssAsset = async (
  outDir: string,
  asset: { content: string; finalFile: string },
): Promise<Result<string>> =>
  writeFile(join(outDir, asset.finalFile), asset.content, "utf8").then(
    () => ok(asset.finalFile),
    (error) =>
      err(`Failed to write ${asset.finalFile}: ${getErrorMessage(error)}`),
  );

const writeIndexHtml = async (
  outDir: string,
  shell: HtmlShell,
  jsFile: string,
  cssFile: string,
): Promise<Result<string>> => {
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

/* ── Pipeline step: create stage/temp dirs, acquire lock ── */

const setupBuildDirectories = async (
  ctx: BuildContext,
): Promise<Result<BuildDirectories>> => {
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
  const bootstrapSource = createBootstrapSource(
    createImportPath(stageDir, ctx.appComponentPath),
    ctx.mountId,
  );
  const bootstrapWritten = await writeFile(
    bootstrapPath,
    bootstrapSource,
    "utf8",
  ).then(
    () => ok(bootstrapPath),
    (error) => err(`Failed to write bootstrap: ${getErrorMessage(error)}`),
  );
  if (!bootstrapWritten.ok) return bootstrapWritten;

  return ok({ lockPath: lock.value, stageDir, tempOutDir, bootstrapPath });
};

/* ── Pipeline step: run Bun.build ── */

const runBunBuild = async (
  ctx: BuildContext,
  dirs: BuildDirectories,
): Promise<Result<BuildBundle>> => {
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
  if (!bundle.success) return err(formatBuildLogs(bundle.logs));

  // yield outputs immediately; finalize steps handle writing
  return ok({ outputs: bundle.outputs, cssByPath });
};

/* ── Pipeline step: finalize JavaScript assets (hash stabilization) ── */

const finalizeJS = async (
  bundle: BuildBundle,
): Promise<
  Result<{ entryAsset: FinalJavaScriptAsset; assets: FinalJavaScriptAsset[] }>
> => {
  const rewrittenAssets = await finalizeJavaScriptAssets(
    bundle.outputs,
    createFinalAssetFile,
    MAX_JS_HASH_STABILIZATION_PASSES,
  );
  if (!rewrittenAssets.ok) return rewrittenAssets;

  const entryAsset = rewrittenAssets.value.find(
    (asset) => asset.kind === "entry-point",
  );
  if (!entryAsset)
    return err("Bun.build succeeded but emitted no JavaScript entry artifact.");

  return ok({ entryAsset, assets: rewrittenAssets.value });
};

/* ── Pipeline step: finalize CSS ── */

const finalizeCSS = async (
  bundle: BuildBundle,
): Promise<Result<{ content: string; finalFile: string }>> => {
  const cssAsset = await finalizeMergedCssAsset(
    bundle.cssByPath,
    createFinalAssetFile,
  );
  if (!cssAsset.ok) return cssAsset;
  return ok(cssAsset.value);
};

/* ── Shared cleanup ── */

const cleanupBuild = async (
  lockPath: string | null,
  stageDir: string,
  tempOutDir: string,
  published: boolean,
): Promise<void> => {
  await rm(stageDir, { force: true, recursive: true }).catch(() => undefined);
  if (!published) {
    await rm(tempOutDir, { force: true, recursive: true }).catch(
      () => undefined,
    );
  }
  if (lockPath) {
    await rm(lockPath, { force: true, recursive: true }).catch(() => undefined);
  }
};

export const buildSvelte = async (
  options: BuildSvelteOptions = {},
): Promise<Result<BuildArtifacts>> => {
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
    await cleanupBuild(
      dirs.value.lockPath,
      dirs.value.stageDir,
      dirs.value.tempOutDir,
      false,
    );
    return bundle;
  }

  const js = await finalizeJS(bundle.value);
  if (!js.ok) {
    await cleanupBuild(
      dirs.value.lockPath,
      dirs.value.stageDir,
      dirs.value.tempOutDir,
      false,
    );
    return js;
  }

  const css = await finalizeCSS(bundle.value);
  if (!css.ok) {
    await cleanupBuild(
      dirs.value.lockPath,
      dirs.value.stageDir,
      dirs.value.tempOutDir,
      false,
    );
    return css;
  }

  const jsWrite = await writeJavaScriptAssets(
    dirs.value.tempOutDir,
    js.value.assets,
  );
  if (!jsWrite.ok) {
    await cleanupBuild(
      dirs.value.lockPath,
      dirs.value.stageDir,
      dirs.value.tempOutDir,
      false,
    );
    return jsWrite;
  }

  const cssFile = await writeCssAsset(dirs.value.tempOutDir, css.value);
  if (!cssFile.ok) {
    await cleanupBuild(
      dirs.value.lockPath,
      dirs.value.stageDir,
      dirs.value.tempOutDir,
      false,
    );
    return cssFile;
  }

  const htmlFile = await writeIndexHtml(
    dirs.value.tempOutDir,
    createHtmlShell(ctx.value.mountId, ctx.value.appTitle),
    js.value.entryAsset.finalFile,
    cssFile.value,
  );
  if (!htmlFile.ok) {
    await cleanupBuild(
      dirs.value.lockPath,
      dirs.value.stageDir,
      dirs.value.tempOutDir,
      false,
    );
    return htmlFile;
  }

  for (const assetsDir of ctx.value.assetsDirs) {
    const assetsOutDir = join(dirs.value.tempOutDir, assetsDir.dirName);
    const copied = await copyConfiguredAssets(
      assetsDir.physicalPath,
      assetsOutDir,
    );
    if (!copied.ok) {
      await cleanupBuild(
        dirs.value.lockPath,
        dirs.value.stageDir,
        dirs.value.tempOutDir,
        false,
      );
      return err(copied.error);
    }
  }

  const published = await publishBuildOutput(
    ctx.value.rootDir,
    dirs.value.tempOutDir,
    ctx.value.outDir,
  );
  if (!published.ok) {
    await cleanupBuild(
      dirs.value.lockPath,
      dirs.value.stageDir,
      dirs.value.tempOutDir,
      false,
    );
    return published;
  }

  await cleanupBuild(
    dirs.value.lockPath,
    dirs.value.stageDir,
    dirs.value.tempOutDir,
    true,
  );

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
