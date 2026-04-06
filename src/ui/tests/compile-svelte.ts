import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { compile } from "svelte/compiler";
import type { Component } from "svelte";

const cacheRoot = resolve(".bun-svelte-cache");

const resolveImportSpecifier = async (sourceFile: string, specifier: string): Promise<string> => {
    const resolved = resolve(dirname(sourceFile), specifier);

    if (resolved.endsWith(".svelte")) {
        const compiled = await compileToFile(resolved);
        return pathToFileURL(compiled).href;
    }

    return pathToFileURL(resolved).href;
};

const rewriteRelativeImports = async (code: string, sourceFile: string): Promise<string> => {
    const matches = [...code.matchAll(/from\s+['"](\.[^'"]+)['"]/g)];
    let rewritten = code;

    for (const match of matches) {
        const original = match[0];
        const specifier = match[1];
        const resolved = await resolveImportSpecifier(sourceFile, specifier);
        rewritten = rewritten.replace(original, `from '${resolved}'`);
    }

    return rewritten;
};

const compileToFile = async (sourceFile: string): Promise<string> => {
    const absoluteSource = resolve(sourceFile);

    mkdirSync(cacheRoot, { recursive: true });

    const outputFile = join(cacheRoot, `${absoluteSource.replace(/[\\/:]/g, "_").replace(extname(absoluteSource), "")}.mjs`);

    const source = readFileSync(absoluteSource, "utf8");
    const result = compile(source, {
        filename: absoluteSource,
        generate: "client",
        css: "injected",
    });

    const rewritten = await rewriteRelativeImports(result.js.code, absoluteSource);
    mkdirSync(dirname(outputFile), { recursive: true });
    writeFileSync(outputFile, rewritten, "utf8");
    return outputFile;
};

export const loadCompiledComponent = async (sourceFile: string, baseUrl: string | URL): Promise<Component<any>> => {
    const outputFile = await compileToFile(fileURLToPath(new URL(sourceFile, baseUrl)));
    const module = await import(pathToFileURL(outputFile).href);
    return module.default as Component<any>;
};
