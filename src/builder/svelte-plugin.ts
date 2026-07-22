import type { BunPlugin } from "bun";
import { compile, compileModule } from "svelte/compiler";

import { createRuntimeModuleSource } from "./build-internals";

export { MOUNT_TARGET_MODULE } from "./runtime";

export type SvelteBunPluginMode = "build" | "dev";

export type SvelteBunPluginOptions = {
    mode: SvelteBunPluginMode;
    cssByPath?: Map<string, string>;
    onCompile?: (path: string, contents: string) => void;
};

const tsTranspiler = new Bun.Transpiler({ loader: "ts" });

const prepareSvelteRunesSource = (path: string, source: string): string => {
    if (!path.endsWith(".svelte.ts")) return source;
    return tsTranspiler.transformSync(source);
};

const createCssInjection = (modulePath: string, cssCode: string | undefined): string => {
    if (!cssCode) return "";

    return [
        "(() => {",
        `    const id = ${JSON.stringify(modulePath)};`,
        `    const current = document.querySelector(\`style[data-svelte-id="\${id}"]\`);`,
        "    if (current) current.remove();",
        "    const style = document.createElement(\"style\");",
        "    style.setAttribute(\"data-svelte-id\", id);",
        `    style.textContent = ${JSON.stringify(cssCode)};`,
        "    document.head.appendChild(style);",
        "})();",
    ].join("\n");
};

const compileSvelteModule = async (
    path: string,
    mode: SvelteBunPluginMode,
): Promise<{ css: string; js: string }> => {
    const source = await Bun.file(path).text();
    const compiled = compile(source, {
        ...(mode === "build"
            ? {
                  css: "external" as const,
                  cssHash: ({ css, hash }) => `_${hash(css)}`,
                  dev: false,
              }
            : { dev: true }),
        filename: path,
        generate: "client",
    });

    return {
        css: compiled.css?.code ?? "",
        js: compiled.js.code,
    };
};

const compileSvelteRunesModule = async (path: string): Promise<string> => {
    const source = await Bun.file(path).text();
    return compileModule(prepareSvelteRunesSource(path, source), { filename: path }).js.code;
};

const isSvelteRunesModule = (path: string): boolean => path.endsWith(".svelte.ts") || path.endsWith(".svelte.js");

const MOUNT_TARGET_NAMESPACE = "svelte-builder-mount-target";

export const createMountTargetPlugin = (mountId: string): BunPlugin => {
    const runtimeSource = createRuntimeModuleSource(mountId);

    return {
        name: "svelte-mount-target-plugin",
        target: "browser",
        setup: (builder) => {
            builder.onResolve({ filter: /^svelte-lib\/runtime$/ }, () => ({
                namespace: MOUNT_TARGET_NAMESPACE,
                path: "mount-target",
            }));

            builder.onLoad({ filter: /^mount-target$/, namespace: MOUNT_TARGET_NAMESPACE }, () => ({
                contents: runtimeSource,
                loader: "js",
            }));
        },
    };
};

export const createSvelteBunPlugin = ({ mode, cssByPath, onCompile }: SvelteBunPluginOptions): BunPlugin => ({
    name: "svelte-bun-plugin",
    target: "browser",
    setup: (builder) => {
        builder.onLoad({ filter: /\.svelte\.(?:ts|js)$/ }, async ({ path }) => {
            if (!isSvelteRunesModule(path)) return undefined;

            try {
                const contents = await compileSvelteRunesModule(path);
                onCompile?.(path, contents);
                return { contents, loader: "js" };
            } catch (error) {
                throw new Error(`Failed to compile ${path}: ${error instanceof Error ? error.message : String(error)}`);
            }
        });

        builder.onLoad({ filter: /\.svelte$/ }, async ({ path }) => {
            try {
                const compiled = await compileSvelteModule(path, mode);
                if (mode === "build" && compiled.css && cssByPath) {
                    cssByPath.set(path, compiled.css);
                }

                const contents = mode === "dev" ? compiled.js + createCssInjection(path, compiled.css) : compiled.js;
                onCompile?.(path, contents);
                return { contents, loader: "js" };
            } catch (error) {
                throw new Error(`Failed to compile ${path}: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
    },
});
