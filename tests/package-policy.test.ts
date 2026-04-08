import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";

const readJson = (path: URL) =>
    JSON.parse(readFileSync(path, "utf8")) as {
        devDependencies?: Record<string, string>;
        bin?: Record<string, string>;
        exports?: Record<string, string>;
        files?: string[];
        module?: string;
        name?: string;
        sideEffects?: boolean | string[];
        scripts?: Record<string, string>;
        peerDependencies?: Record<string, string>;
    };

test("root package owns builder dependency policy without pretending to be a builder app", () => {
    const rootPackage = readJson(new URL("../package.json", import.meta.url));

    expect(rootPackage.devDependencies).toEqual({
        "@types/bun": "latest",
        "@types/node": "latest",
        jsdom: "latest",
        svelte: "latest",
        "svelte-check": "latest",
        typescript: "latest",
    });

    expect(rootPackage.peerDependencies).toEqual({
        svelte: "latest",
    });

    expect(rootPackage.module).toBe("./src/_.ts");

    expect(rootPackage.exports).toEqual({
        ".": "./src/_.ts",
        "./ui": "./src/ui/_.ts",
        "./use": "./src/use/_.ts",
        "./route": "./src/route/_.ts",
        "./builder": "./src/builder/_.ts",
        "./package.json": "./package.json",
    });

    expect(rootPackage.bin).toEqual({
        "svelte-build": "./src/builder/build.ts",
        "svelte-dev": "./src/builder/dev.ts",
    });

    expect(rootPackage.files).toEqual(["src", "README.md", "global.d.ts"]);
    expect(rootPackage.sideEffects).toBe(false);

    expect(rootPackage.scripts?.["builder:build"]).toBeUndefined();
    expect(rootPackage.scripts?.["builder:dev"]).toBeUndefined();

    expect(existsSync(new URL("../src/builder/package.json", import.meta.url))).toBe(false);
    expect(existsSync(new URL("../src/builder/cli.ts", import.meta.url))).toBe(false);
});

test("repo no longer carries a top-level demo app or demo export", () => {
    const rootPackage = readJson(new URL("../package.json", import.meta.url));

    expect(existsSync(new URL("../demo", import.meta.url))).toBe(false);
    expect(rootPackage.exports?.["./demo"]).toBeUndefined();
});
