import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";

const readJson = (path: URL) =>
    JSON.parse(readFileSync(path, "utf8")) as {
        devDependencies?: Record<string, string>;
        bin?: Record<string, string>;
        exports?: Record<string, string>;
        name?: string;
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

    expect(rootPackage.exports).toEqual({
        ".": "./_.ts",
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

    expect(rootPackage.scripts?.["builder:build"]).toBeUndefined();
    expect(rootPackage.scripts?.["builder:dev"]).toBeUndefined();

    expect(existsSync(new URL("../src/builder/package.json", import.meta.url))).toBe(false);
    expect(existsSync(new URL("../src/builder/cli.ts", import.meta.url))).toBe(false);
});

test("top-level demo exists as a sample app without becoming a package export", () => {
    const rootPackage = readJson(new URL("../package.json", import.meta.url));
    const demoPackage = readJson(new URL("../demo/package.json", import.meta.url));
    const demoAppSource = readFileSync(new URL("../demo/src/App.svelte", import.meta.url), "utf8");

    expect(existsSync(new URL("../demo/package.json", import.meta.url))).toBe(true);
    expect(existsSync(new URL("../demo/builder.ts", import.meta.url))).toBe(true);
    expect(existsSync(new URL("../demo/src/App.svelte", import.meta.url))).toBe(true);
    expect(existsSync(new URL("../demo/src/routes/LazyProfile.svelte", import.meta.url))).toBe(true);
    expect(rootPackage.exports?.["./demo"]).toBeUndefined();
    expect(demoPackage.name).toBe("svelte-lib-demo");
    expect(demoPackage.scripts).toEqual({
        dev: "svelte-dev",
        build: "svelte-build",
        typecheck: "svelte-check --tsconfig ./tsconfig.json",
    });
    expect(demoPackage.devDependencies).toEqual({
        "svelte-check": "latest",
        typescript: "latest",
    });
    expect(demoAppSource.includes('component={() => import("./routes/LazyProfile.svelte")}')).toBe(true);
    expect(demoAppSource.includes('routePush("/lazy')).toBe(true);
    expect(existsSync(new URL("../demo/tsconfig.json", import.meta.url))).toBe(true);
});
