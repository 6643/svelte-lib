import { expect, test } from "bun:test";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { resolveBareImportPathForDev } from "../dev";

const createTempSveltePackage = async () => {
    const rootDir = `/tmp/svelte-builder-dev-imports-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const packageRoot = join(rootDir, "node_modules", "svelte");
    const importerPath = join(packageRoot, "src", "internal", "client", "reactivity", "batch.js");

    await mkdir(join(packageRoot, "src", "internal", "client", "reactivity"), { recursive: true });
    await mkdir(join(packageRoot, "src", "internal", "client"), { recursive: true });
    await writeFile(
        join(packageRoot, "package.json"),
        JSON.stringify({
            imports: {
                "#client/constants": "./src/internal/client/constants.js",
            },
            name: "svelte",
        }),
        "utf8",
    );
    await writeFile(importerPath, 'import { FLAG } from "#client/constants";', "utf8");
    await writeFile(join(packageRoot, "src", "internal", "client", "constants.js"), "export const FLAG = true;", "utf8");

    return { importerPath, rootDir };
};

const createTempAppPackage = async () => {
    const rootDir = `/tmp/svelte-builder-app-imports-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const importerPath = join(rootDir, "src", "entry.ts");

    await mkdir(join(rootDir, "src"), { recursive: true });
    await writeFile(
        join(rootDir, "package.json"),
        JSON.stringify({
            imports: {
                "#client": "./src/client.ts",
            },
            name: "review-app",
        }),
        "utf8",
    );
    await writeFile(importerPath, 'import "#client";', "utf8");
    await writeFile(join(rootDir, "src", "client.ts"), "export const FLAG = true;", "utf8");

    return { importerPath, rootDir };
};

const createTempNestedAppPackage = async () => {
    const rootDir = `/tmp/svelte-builder-nested-app-imports-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const packageRoot = join(rootDir, "packages", "demo");
    const importerPath = join(packageRoot, "src", "entry.ts");

    await mkdir(join(packageRoot, "src"), { recursive: true });
    await writeFile(
        join(packageRoot, "package.json"),
        JSON.stringify({
            imports: {
                "#client": "./src/client.ts",
            },
            name: "demo-app",
        }),
        "utf8",
    );
    await writeFile(importerPath, 'import "#client";', "utf8");
    await writeFile(join(packageRoot, "src", "client.ts"), "export const FLAG = true;", "utf8");

    return { importerPath, rootDir };
};

const createTempExternalPackageImportApp = async () => {
    const rootDir = `/tmp/svelte-builder-external-package-imports-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const importerPath = join(rootDir, "src", "entry.ts");

    await mkdir(join(rootDir, "src"), { recursive: true });
    await writeFile(
        join(rootDir, "package.json"),
        JSON.stringify({
            imports: {
                "#runtime": "svelte",
            },
            name: "external-import-app",
        }),
        "utf8",
    );
    await writeFile(importerPath, 'import "#runtime";', "utf8");

    return { importerPath, rootDir };
};

test("resolveBareImportPathForDev rewrites package imports against the importer package root", async () => {
    const { importerPath, rootDir } = await createTempSveltePackage();

    try {
        const result = await resolveBareImportPathForDev("#client/constants", importerPath);

        expect(result.ok).toBe(true);
        if (!result.ok) {
            throw new Error(result.error);
        }

        expect(result.value).toBe("/_node_modules/svelte/src/internal/client/constants.js");
    } finally {
        await rm(rootDir, { force: true, recursive: true });
    }
});

test("resolveBareImportPathForDev rejects app-local package imports on the app source path", async () => {
    const { importerPath, rootDir } = await createTempAppPackage();

    try {
        const result = await resolveBareImportPathForDev("#client", importerPath);

        expect(result.ok).toBe(false);
        if (result.ok) {
            throw new Error("Expected app-local package imports to be unsupported");
        }

        expect(result.error.includes("package imports are not supported")).toBe(true);
    } finally {
        await rm(rootDir, { force: true, recursive: true });
    }
});

test("resolveBareImportPathForDev rejects nested app package imports", async () => {
    const { importerPath, rootDir } = await createTempNestedAppPackage();

    try {
        const result = await resolveBareImportPathForDev("#client", importerPath);

        expect(result.ok).toBe(false);
        if (result.ok) {
            throw new Error("Expected nested app package imports to be unsupported");
        }

        expect(result.error.includes("package imports are not supported")).toBe(true);
    } finally {
        await rm(rootDir, { force: true, recursive: true });
    }
});

test("resolveBareImportPathForDev rejects app-local package imports that target external dependencies", async () => {
    const { importerPath, rootDir } = await createTempExternalPackageImportApp();

    try {
        const result = await resolveBareImportPathForDev("#runtime", importerPath);

        expect(result.ok).toBe(false);
        if (result.ok) {
            throw new Error("Expected app-local package imports to be unsupported");
        }

        expect(result.error.includes("package imports are not supported")).toBe(true);
    } finally {
        await rm(rootDir, { force: true, recursive: true });
    }
});
