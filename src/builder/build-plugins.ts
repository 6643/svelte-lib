import type { BunPlugin } from "bun";
import { compile } from "svelte/compiler";
import { resolveSvelteBrowserImportPath } from "./build-validate";
import { stripSvelteDiagnosticsModule } from "./strip-svelte-diagnostics";
import type { Result } from "./build";

const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) return error.message;
    return String(error);
};

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const fail = (error: string): Result<never> => ({ ok: false, error });

const createScopedCssClassName = (css: string, hash: (input: string) => string): string => `_${hash(css)}`;

const readRequiredText = async (path: string): Promise<Result<string>> => {
    const file = Bun.file(path);
    const exists = await file.exists();
    if (!exists) return fail(`Missing file: ${path}`);

    return file.text().then(
        (value) => ok(value),
        (error) => fail(`Failed to read ${path}: ${getErrorMessage(error)}`),
    );
};

const compileSvelteModule = async (path: string): Promise<Result<{ css: string; js: string }>> => {
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
            (error) => fail(`Failed to compile ${path}: ${getErrorMessage(error)}`),
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
            if (resolvedPath === null) return null;

            return { path: resolvedPath };
        });
    },
});

export const createSveltePlugin = (cssByPath: Map<string, string>): BunPlugin => ({
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
