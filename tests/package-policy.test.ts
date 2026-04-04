import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const readJson = (path: URL) =>
    JSON.parse(readFileSync(path, "utf8")) as {
        devDependencies?: Record<string, string>;
        peerDependencies?: Record<string, string>;
    };

test("root and builder packages follow the repository latest policy", () => {
    const rootPackage = readJson(new URL("../package.json", import.meta.url));
    const builderPackage = readJson(new URL("../builder/package.json", import.meta.url));

    expect(rootPackage.devDependencies).toMatchObject({
        "@types/bun": "latest",
        "@types/node": "latest",
        jsdom: "latest",
        svelte: "latest",
        "svelte-check": "latest",
        typescript: "latest",
    });

    expect(rootPackage.peerDependencies).toEqual({
        svelte: "latest",
        typescript: "latest",
    });

    expect(builderPackage.devDependencies).toMatchObject({
        "@types/bun": "latest",
        "@types/node": "latest",
        esbuild: "latest",
        svelte: "latest",
    });

    expect(builderPackage.peerDependencies).toEqual({
        svelte: "latest",
        typescript: "latest",
    });
});
