import { expect, test } from "bun:test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";
import { compile, compileModule } from "svelte/compiler";
import { flushSync, mount, unmount, type Component } from "svelte";

const cacheRoot = resolve(".bun-svelte-cache", "ui");
const tsTranspiler = new Bun.Transpiler({ loader: "ts" });

const isRuneModule = (path: string): boolean => path.endsWith(".svelte.ts") || path.endsWith(".svelte.js");

const prepareRuneSource = (path: string, source: string): string => {
    if (!path.endsWith(".svelte.ts")) return source;
    return tsTranspiler.transformSync(source);
};

const resolveImportSpecifier = async (sourceFile: string, specifier: string): Promise<string> => {
    const resolved = resolve(dirname(sourceFile), specifier);
    if (isRuneModule(resolved)) {
        return pathToFileURL(await compileRuneModuleToFile(resolved)).href;
    }

    if (resolved.endsWith(".svelte")) {
        return pathToFileURL(await compileToFile(resolved)).href;
    }

    return pathToFileURL(resolved).href;
};

const rewriteRelativeImports = async (code: string, sourceFile: string): Promise<string> => {
    const matches = [...code.matchAll(/from\s+['"](\.[^'"]+)['"]/g)];
    let rewritten = code;

    for (const match of matches) {
        const original = match[0];
        const specifier = match[1];
        rewritten = rewritten.replace(original, `from '${await resolveImportSpecifier(sourceFile, specifier)}'`);
    }

    return rewritten;
};

const compileToFile = async (sourceFile: string): Promise<string> => {
    const absoluteSource = resolve(sourceFile);
    const outputFile = join(cacheRoot, `${absoluteSource.replace(/[\\/:]/g, "_").replace(extname(absoluteSource), "")}.mjs`);
    const source = readFileSync(absoluteSource, "utf8");
    const compiled = compile(source, {
        css: "injected",
        filename: absoluteSource,
        generate: "client",
    });

    mkdirSync(dirname(outputFile), { recursive: true });
    writeFileSync(outputFile, await rewriteRelativeImports(compiled.js.code, absoluteSource), "utf8");
    return outputFile;
};

const compileRuneModuleToFile = async (sourceFile: string): Promise<string> => {
    const absoluteSource = resolve(sourceFile);
    const outputFile = join(cacheRoot, `${absoluteSource.replace(/[\\/:]/g, "_").replace(extname(absoluteSource), "")}.mjs`);
    const source = readFileSync(absoluteSource, "utf8");
    const compiled = compileModule(prepareRuneSource(absoluteSource, source), {
        filename: absoluteSource,
    });

    mkdirSync(dirname(outputFile), { recursive: true });
    writeFileSync(outputFile, await rewriteRelativeImports(compiled.js.code, absoluteSource), "utf8");
    return outputFile;
};

const loadUiComponent = async (fileName: string): Promise<Component<any>> => {
    const module = await import(pathToFileURL(await compileToFile(resolve(import.meta.dir, fileName))).href);
    return module.default as Component<any>;
};

const installDom = () => {
    const dom = new JSDOM('<!doctype html><div id="app"></div>', {
        url: "https://app.test/",
    });
    type BrowserGlobalKey = "document" | "Element" | "HTMLElement" | "navigator" | "Node" | "SVGElement" | "Text" | "window";
    const previousDescriptors = new Map<BrowserGlobalKey, PropertyDescriptor | undefined>();
    const setGlobal = (key: BrowserGlobalKey, value: unknown): void => {
        previousDescriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
        Object.defineProperty(globalThis, key, {
            configurable: true,
            value,
            writable: true,
        });
    };
    const restoreGlobal = (key: BrowserGlobalKey): void => {
        const descriptor = previousDescriptors.get(key);
        if (descriptor) {
            Object.defineProperty(globalThis, key, descriptor);
            return;
        }

        delete (globalThis as Partial<Record<BrowserGlobalKey, unknown>>)[key];
    };

    setGlobal("window", dom.window);
    setGlobal("document", dom.window.document);
    setGlobal("Element", dom.window.Element);
    setGlobal("HTMLElement", dom.window.HTMLElement);
    setGlobal("navigator", dom.window.navigator);
    setGlobal("Node", dom.window.Node);
    setGlobal("SVGElement", dom.window.SVGElement);
    setGlobal("Text", dom.window.Text);

    return {
        target: dom.window.document.getElementById("app")!,
        cleanup: () => {
            dom.window.close();
            for (const key of [...previousDescriptors.keys()].reverse()) {
                restoreGlobal(key);
            }
        },
    };
};

test("IconButton renders provided svg paths as SVG children", async () => {
    const { target, cleanup } = installDom();
    const IconButton = await loadUiComponent("IconButton.svelte");
    const icon = '<path data-icon="review" d="M0 0h1v1z"/>';

    try {
        const instance = mount(IconButton, { target, props: { svgPaths: icon } });
        flushSync();

        expect(target.querySelector("button")?.getAttribute("type")).toBe("button");
        expect(target.querySelector("svg path")?.getAttribute("data-icon")).toBe("review");
        expect(target.textContent).not.toContain("<path");

        await unmount(instance);
    } finally {
        cleanup();
    }
});

test("TextButton keeps its icon prop visible and does not submit forms by default", async () => {
    const { target, cleanup } = installDom();
    const TextButton = await loadUiComponent("TextButton.svelte");
    const icon = '<path data-icon="text-review" d="M0 0h1v1z"/>';

    try {
        const instance = mount(TextButton, { target, props: { icon, text: "Save" } });
        flushSync();

        expect(target.querySelector("button")?.getAttribute("type")).toBe("button");
        expect(target.querySelector("svg path")?.getAttribute("data-icon")).toBe("text-review");
        expect(target.textContent).toContain("Save");

        await unmount(instance);
    } finally {
        cleanup();
    }
});
