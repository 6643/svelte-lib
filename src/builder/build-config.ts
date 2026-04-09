import { randomUUID } from "node:crypto";
import { readFile, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { deserialize } from "node:v8";

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

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

export const CONFIG_FILE_NAME = "builder.ts";

const LOAD_CONFIG_RUNNER_PATH = join(dirname(fileURLToPath(import.meta.url)), "load-config-runner.ts");

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

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const fail = (error: string): Result<never> => ({ ok: false, error });

const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) {
        return error.message;
    }

    return String(error);
};

const hasOwnProperty = (value: object, key: string): boolean => Object.prototype.hasOwnProperty.call(value, key);

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const readOptionalStringField = (config: Record<string, unknown>, field: string): Result<string | undefined> => {
    if (!hasOwnProperty(config, field) || config[field] === undefined) {
        return ok(undefined);
    }

    if (typeof config[field] === "string") {
        return ok(config[field]);
    }

    return fail(`Invalid ${field} in ${CONFIG_FILE_NAME}: expected string.`);
};

const readOptionalAssetsDirsField = (config: Record<string, unknown>, field: string): Result<string[] | undefined> => {
    if (!hasOwnProperty(config, field) || config[field] === undefined) {
        return ok(undefined);
    }

    if (Array.isArray(config[field]) && config[field].every((entry) => typeof entry === "string")) {
        return ok(config[field] as string[]);
    }

    return fail(`Invalid ${field} in ${CONFIG_FILE_NAME}: expected string array.`);
};

const readOptionalAppComponentField = (config: Record<string, unknown>, field: string): Result<string | undefined> => {
    const appComponent = readOptionalStringField(config, field);
    if (!appComponent.ok) {
        return appComponent;
    }

    return ok(appComponent.value ?? "src/App.svelte");
};

const readOptionalNumberField = (config: Record<string, unknown>, field: string): Result<number | undefined> => {
    if (!hasOwnProperty(config, field) || config[field] === undefined) {
        return ok(undefined);
    }

    if (typeof config[field] === "number" && Number.isInteger(config[field]) && config[field] >= 0) {
        return ok(config[field]);
    }

    return fail(`Invalid ${field} in ${CONFIG_FILE_NAME}: expected non-negative integer.`);
};

const readOptionalBooleanField = (config: Record<string, unknown>, field: string): Result<boolean | undefined> => {
    if (!hasOwnProperty(config, field) || config[field] === undefined) {
        return ok(undefined);
    }

    if (typeof config[field] === "boolean") {
        return ok(config[field]);
    }

    return fail(`Invalid ${field} in ${CONFIG_FILE_NAME}: expected boolean.`);
};

const isValidMountId = (mountId: string): boolean => !/\s/u.test(mountId) && !mountId.startsWith("#");

export const validateMountId = (value: unknown, field: string): Result<string> => {
    if (value !== undefined && typeof value !== "string") {
        return fail(`Invalid ${field} in ${CONFIG_FILE_NAME}: expected string.`);
    }

    const mountId = value ?? "app";
    const normalizedMountId = mountId.trim();

    if (normalizedMountId.length === 0) {
        return fail(`Invalid ${field} in ${CONFIG_FILE_NAME}: expected a non-empty id token.`);
    }

    if (normalizedMountId !== mountId) {
        return fail(`Invalid ${field} in ${CONFIG_FILE_NAME}: expected a plain id token, not a selector-shaped value.`);
    }

    if (!isValidMountId(normalizedMountId)) {
        return fail(`Invalid ${field} in ${CONFIG_FILE_NAME}: expected a plain id token, not a selector-shaped value.`);
    }

    return ok(normalizedMountId);
};

export const validateAppComponent = (value: unknown, field: string): Result<string> => {
    if (value !== undefined && typeof value !== "string") {
        return fail(`Invalid ${field} in ${CONFIG_FILE_NAME}: expected string.`);
    }

    const appComponent = value ?? "src/App.svelte";
    const normalizedAppComponent = appComponent.trim();

    if (normalizedAppComponent.length === 0) {
        return fail(`Invalid ${field} in ${CONFIG_FILE_NAME}: expected a non-empty component path.`);
    }

    if (normalizedAppComponent !== appComponent) {
        return fail(`Invalid ${field} in ${CONFIG_FILE_NAME}: expected a plain component path, not a whitespace-padded value.`);
    }

    return ok(normalizedAppComponent);
};

const parseBuildConfig = (value: unknown, configFileName = CONFIG_FILE_NAME): Result<BuildSvelteOptions> => {
    if (!isRecord(value)) {
        return fail(`Invalid ${configFileName}: expected a default-exported object config.`);
    }

    if (hasOwnProperty(value, "htmlTemplate")) {
        return fail(`Invalid htmlTemplate in ${configFileName}: htmlTemplate is no longer supported.`);
    }

    const unknownField = Object.keys(value).find(
        (field) => !SUPPORTED_CONFIG_FIELDS.includes(field as (typeof SUPPORTED_CONFIG_FIELDS)[number]),
    );
    if (unknownField !== undefined) {
        return fail(`Unknown field in ${configFileName}: ${unknownField}.`);
    }

    const appTitle = readOptionalStringField(value, "appTitle");
    if (!appTitle.ok) {
        return appTitle;
    }

    const appComponent = readOptionalAppComponentField(value, "appComponent");
    if (!appComponent.ok) {
        return appComponent;
    }

    if (hasOwnProperty(value, "assetsDir")) {
        return fail(`Unknown field in ${configFileName}: assetsDir.`);
    }

    const assetsDirs = readOptionalAssetsDirsField(value, "assetsDirs");
    if (!assetsDirs.ok) {
        return assetsDirs;
    }

    const outDir = readOptionalStringField(value, "outDir");
    if (!outDir.ok) {
        return outDir;
    }

    const mountId = readOptionalStringField(value, "mountId");
    if (!mountId.ok) {
        return mountId;
    }

    const normalizedMountId = validateMountId(mountId.value, "mountId");
    if (!normalizedMountId.ok) {
        return normalizedMountId;
    }

    const port = readOptionalNumberField(value, "port");
    if (!port.ok) {
        return port;
    }

    const sourcemap = readOptionalBooleanField(value, "sourcemap");
    if (!sourcemap.ok) {
        return sourcemap;
    }

    const stripSvelteDiagnostics = readOptionalBooleanField(value, "stripSvelteDiagnostics");
    if (!stripSvelteDiagnostics.ok) {
        return stripSvelteDiagnostics;
    }

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

export const defineSvelteConfig = (config: BuildSvelteOptions): BuildSvelteOptions => config;

const loadModuleConfigFile = async (configPath: string): Promise<Result<unknown>> => {
    const outputPath = join("/tmp", `svelte-lib-config-${randomUUID()}.bin`);

    try {
        const subprocess = Bun.spawn({
            cmd: [process.execPath, LOAD_CONFIG_RUNNER_PATH, configPath, outputPath],
            stderr: "pipe",
            stdout: "pipe",
        });
        const [exitCode, stderr, stdout] = await Promise.all([
            subprocess.exited,
            new Response(subprocess.stderr).text(),
            new Response(subprocess.stdout).text(),
        ]);

        if (exitCode !== 0) {
            const errorMessage = stderr.trim() || stdout.trim() || `Config loader exited with code ${exitCode}`;
            return fail(`Failed to load ${configPath}: ${errorMessage}`);
        }

        return ok(deserialize(await readFile(outputPath)));
    } catch (error) {
        return fail(`Failed to load ${configPath}: ${getErrorMessage(error)}`);
    } finally {
        await rm(outputPath, { force: true }).catch(() => undefined);
    }
};

export const loadSvelteConfig = async (cwd = process.cwd()): Promise<Result<BuildSvelteOptions>> => {
    const configRoot = resolve(cwd);
    const configPath = join(configRoot, CONFIG_FILE_NAME);
    const configExists = await Bun.file(configPath).exists();
    if (!configExists) {
        const legacyJsonConfigPath = join(configRoot, "svelte-builder.config.json");
        if (await Bun.file(legacyJsonConfigPath).exists()) {
            return fail(`Legacy config is no longer supported: ${legacyJsonConfigPath}. Rename it to ${configPath}.`);
        }

        return fail(`Missing config: ${configPath}`);
    }

    const loaded = await loadModuleConfigFile(configPath);
    if (!loaded.ok) {
        return loaded;
    }

    const parsed = parseBuildConfig(loaded.value, CONFIG_FILE_NAME);
    if (!parsed.ok) {
        return parsed;
    }

    return ok({
        ...parsed.value,
        rootDir: configRoot,
    });
};
