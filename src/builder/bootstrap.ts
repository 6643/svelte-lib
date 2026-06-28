import { isAbsolute, join, relative } from "node:path";
import { normalizeModulePath } from "./utils";
export { resolveConfiguredPath } from "./utils";

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

export const createBootstrapModuleSource = createBootstrapSource;
