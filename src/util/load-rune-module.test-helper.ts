import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { compile, compileModule } from "svelte/compiler";

const cacheRoot = resolve(".bun-svelte-cache", "runes");
const tsTranspiler = new Bun.Transpiler({ loader: "ts" });

const isRuneModule = (path: string): boolean => path.endsWith(".svelte.ts") || path.endsWith(".svelte.js");

const prepareRuneSource = (path: string, source: string): string => {
    if (!path.endsWith(".svelte.ts")) return source;
    return tsTranspiler.transformSync(source);
};

const toOutputFile = (sourceFile: string): string =>
    join(cacheRoot, `${sourceFile.replace(/[\\/:]/g, "_").replace(extname(sourceFile), "")}.mjs`);

const resolveImportSpecifier = async (sourceFile: string, specifier: string): Promise<string> => {
    const resolved = resolve(dirname(sourceFile), specifier);

    if (isRuneModule(resolved)) {
        return pathToFileURL(await compileRuneModuleToFile(resolved)).href;
    }

    if (resolved.endsWith(".svelte")) {
        return pathToFileURL(await compileComponentToFile(resolved)).href;
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

const compileComponentToFile = async (sourceFile: string): Promise<string> => {
    const absoluteSource = resolve(sourceFile);
    const outputFile = toOutputFile(absoluteSource);
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
    const outputFile = toOutputFile(absoluteSource);
    const source = readFileSync(absoluteSource, "utf8");
    const compiled = compileModule(prepareRuneSource(absoluteSource, source), {
        filename: absoluteSource,
    });

    mkdirSync(dirname(outputFile), { recursive: true });
    writeFileSync(outputFile, await rewriteRelativeImports(compiled.js.code, absoluteSource), "utf8");
    return outputFile;
};

export const loadRuneModule = async <TModule>(sourceFile: string, baseUrl: string | URL): Promise<TModule> => {
    const absoluteSource = fileURLToPath(new URL(sourceFile, baseUrl));
    return import(pathToFileURL(await compileRuneModuleToFile(absoluteSource)).href) as Promise<TModule>;
};
