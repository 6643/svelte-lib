import { realpathSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  ok,
  err,
  getErrorMessage,
  isPathWithinRoot,
  type Result,
} from "./build";

export const CONFIG_FILE_NAME = "builder.ts";

export type BuildSvelteOptions = {
  appTitle?: string;
  appComponent?: string;
  assetsDirs?: string[];
  mountId?: string;
  outDir?: string;
  port?: number;
  rootDir?: string;
  stripSvelteDiagnostics?: boolean;
  sourcemap?: boolean;
};

const SUPPORTED_CONFIG_FIELDS = [
  "appComponent",
  "appTitle",
  "assetsDirs",
  "mountId",
  "outDir",
  "port",
  "rootDir",
  "sourcemap",
  "stripSvelteDiagnostics",
] as const;

const hasOwnProperty = (value: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);
const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readOptionalStringField = (
  config: Record<string, unknown>,
  field: string,
): Result<string | undefined> => {
  if (!hasOwnProperty(config, field) || config[field] === undefined) {
    return ok(undefined);
  }
  if (typeof config[field] === "string") {
    return ok(config[field]);
  }
  return err(`Invalid ${field} in ${CONFIG_FILE_NAME}: expected string.`);
};

const readOptionalAssetsDirsField = (
  config: Record<string, unknown>,
  field: string,
): Result<string[] | undefined> => {
  if (!hasOwnProperty(config, field) || config[field] === undefined) {
    return ok(undefined);
  }
  if (
    Array.isArray(config[field]) &&
    config[field].every((entry) => typeof entry === "string")
  ) {
    return ok(config[field] as string[]);
  }
  return err(`Invalid ${field} in ${CONFIG_FILE_NAME}: expected string array.`);
};

const readOptionalAppComponentField = (
  config: Record<string, unknown>,
  field: string,
): Result<string | undefined> => {
  const appComponent = readOptionalStringField(config, field);
  if (!appComponent.ok) return appComponent;
  return ok(appComponent.value ?? "src/App.svelte");
};

const readOptionalNumberField = (
  config: Record<string, unknown>,
  field: string,
): Result<number | undefined> => {
  if (!hasOwnProperty(config, field) || config[field] === undefined) {
    return ok(undefined);
  }
  if (
    typeof config[field] === "number" &&
    Number.isInteger(config[field]) &&
    config[field] >= 0
  ) {
    return ok(config[field]);
  }
  return err(
    `Invalid ${field} in ${CONFIG_FILE_NAME}: expected non-negative integer.`,
  );
};

const readOptionalBooleanField = (
  config: Record<string, unknown>,
  field: string,
): Result<boolean | undefined> => {
  if (!hasOwnProperty(config, field) || config[field] === undefined) {
    return ok(undefined);
  }
  if (typeof config[field] === "boolean") {
    return ok(config[field]);
  }
  return err(`Invalid ${field} in ${CONFIG_FILE_NAME}: expected boolean.`);
};

export const validateMountId = (
  value: unknown,
  field: string,
): Result<string> => {
  if (value !== undefined && typeof value !== "string") {
    return err(`Invalid ${field} in ${CONFIG_FILE_NAME}: expected string.`);
  }
  const mountId = value ?? "app";
  const normalizedMountId = mountId.trim();
  if (normalizedMountId.length === 0) {
    return err(
      `Invalid ${field} in ${CONFIG_FILE_NAME}: expected a non-empty id token.`,
    );
  }
  if (normalizedMountId !== mountId) {
    return err(
      `Invalid ${field} in ${CONFIG_FILE_NAME}: expected a plain id token, not a selector-shaped value.`,
    );
  }
  if (/\s/u.test(normalizedMountId) || normalizedMountId.startsWith("#")) {
    return err(
      `Invalid ${field} in ${CONFIG_FILE_NAME}: expected a plain id token, not a selector-shaped value.`,
    );
  }
  return ok(normalizedMountId);
};

export const validateAppComponent = (
  value: unknown,
  field: string,
): Result<string> => {
  if (value !== undefined && typeof value !== "string") {
    return err(`Invalid ${field} in ${CONFIG_FILE_NAME}: expected string.`);
  }
  const appComponent = value ?? "src/App.svelte";
  const normalizedAppComponent = appComponent.trim();
  if (normalizedAppComponent.length === 0) {
    return err(
      `Invalid ${field} in ${CONFIG_FILE_NAME}: expected a non-empty component path.`,
    );
  }
  if (normalizedAppComponent !== appComponent) {
    return err(
      `Invalid ${field} in ${CONFIG_FILE_NAME}: expected a plain component path, not a whitespace-padded value.`,
    );
  }
  return ok(normalizedAppComponent);
};

export const parseBuildConfig = (
  value: unknown,
  configFileName = CONFIG_FILE_NAME,
): Result<BuildSvelteOptions> => {
  if (!isRecord(value)) {
    return err(
      `Invalid ${configFileName}: expected a default-exported object config.`,
    );
  }
  if (hasOwnProperty(value, "htmlTemplate")) {
    return err(
      `Invalid htmlTemplate in ${configFileName}: htmlTemplate is no longer supported.`,
    );
  }
  const unknownField = Object.keys(value).find(
    (field) =>
      !SUPPORTED_CONFIG_FIELDS.includes(
        field as (typeof SUPPORTED_CONFIG_FIELDS)[number],
      ),
  );
  if (unknownField !== undefined) {
    return err(`Unknown field in ${configFileName}: ${unknownField}.`);
  }

  const appTitle = readOptionalStringField(value, "appTitle");
  if (!appTitle.ok) return appTitle;
  const appComponent = readOptionalAppComponentField(value, "appComponent");
  if (!appComponent.ok) return appComponent;
  if (hasOwnProperty(value, "assetsDir")) {
    return err(`Unknown field in ${configFileName}: assetsDir.`);
  }
  const assetsDirs = readOptionalAssetsDirsField(value, "assetsDirs");
  if (!assetsDirs.ok) return assetsDirs;
  const outDir = readOptionalStringField(value, "outDir");
  if (!outDir.ok) return outDir;
  const mountId = readOptionalStringField(value, "mountId");
  if (!mountId.ok) return mountId;
  const normalizedMountId = validateMountId(mountId.value, "mountId");
  if (!normalizedMountId.ok) return normalizedMountId;
  const port = readOptionalNumberField(value, "port");
  if (!port.ok) return port;
  const sourcemap = readOptionalBooleanField(value, "sourcemap");
  if (!sourcemap.ok) return sourcemap;
  const stripSvelteDiagnostics = readOptionalBooleanField(
    value,
    "stripSvelteDiagnostics",
  );
  if (!stripSvelteDiagnostics.ok) return stripSvelteDiagnostics;

  return ok({
    appTitle: appTitle.value,
    appComponent: appComponent.value,
    assetsDirs: assetsDirs.value,
    mountId: normalizedMountId.value,
    outDir: outDir.value,
    port: port.value,
    stripSvelteDiagnostics: stripSvelteDiagnostics.value,
    sourcemap: sourcemap.value,
  });
};

export const defineSvelteConfig = (
  config: BuildSvelteOptions,
): BuildSvelteOptions => config;

export const loadSvelteConfig = async (
  cwd = process.cwd(),
): Promise<Result<BuildSvelteOptions>> => {
  const configRoot = resolve(cwd);
  const configPath = join(configRoot, CONFIG_FILE_NAME);
  const configExists = await Bun.file(configPath).exists();
  if (!configExists) {
    const legacyJsonConfigPath = join(configRoot, "svelte-builder.config.json");
    if (await Bun.file(legacyJsonConfigPath).exists()) {
      return err(
        `Legacy config is no longer supported: ${legacyJsonConfigPath}. Rename it to ${configPath}.`,
      );
    }
    return err(`Missing config: ${configPath}`);
  }

  // 直接 import 加载配置文件
  try {
    const loaded = await import(pathToFileURL(configPath).href);
    const parsed = parseBuildConfig(loaded.default, CONFIG_FILE_NAME);
    if (!parsed.ok) return parsed;
    return ok({
      ...parsed.value,
      rootDir: configRoot,
    });
  } catch (error) {
    return err(`Failed to load ${configPath}: ${getErrorMessage(error)}`);
  }
};

export const resolveAppSourceRoot = (
  rootDir: string,
  appComponentPath: string,
  configFileName = CONFIG_FILE_NAME,
): Result<string> => {
  const appComponentRelativeToRoot = relative(rootDir, appComponentPath);
  if (
    appComponentRelativeToRoot.startsWith("..") ||
    isAbsolute(appComponentRelativeToRoot)
  ) {
    return err(
      `Invalid appComponent in ${configFileName}: expected a path inside the project root.`,
    );
  }
  const segments = appComponentRelativeToRoot
    .split(/[\\/]/)
    .filter((segment) => segment.length > 0);
  const [topLevelDir] = segments;
  if (topLevelDir === undefined || segments.length <= 1) {
    return err(
      `Invalid appComponent in ${configFileName}: expected a component path inside src/ or another top-level source directory.`,
    );
  }
  return ok(
    topLevelDir === "src" ? join(rootDir, "src") : join(rootDir, topLevelDir),
  );
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
    } catch {
      return null;
    }
  })();
  if (physicalPath === null) {
    return ok(resolvedAppComponentPath);
  }
  if (
    !isPathWithinRoot(rootDir, physicalPath) ||
    !isPathWithinRoot(appSourceRoot, physicalPath)
  ) {
    return err(
      `Invalid appComponent in ${configFileName}: symbolic links must resolve inside the app source tree (${appSourceRoot}).`,
    );
  }
  return ok(resolvedAppComponentPath);
};
