import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";

const readJson = (path: URL) =>
    JSON.parse(readFileSync(path, "utf8")) as {
        scripts?: Record<string, string>;
        devDependencies?: Record<string, string>;
        peerDependencies?: Record<string, string>;
    };

test("root package owns builder dependency policy and scripts", () => {
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

    expect(rootPackage.scripts?.["builder:build"]).toBe("cd builder && bun run build.ts build");
    expect(rootPackage.scripts?.["builder:dev"]).toBe("cd builder && bun run build.ts dev");

    expect(existsSync(new URL("../builder/package.json", import.meta.url))).toBe(false);
});
