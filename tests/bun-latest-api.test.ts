import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dir, "..");

const readRepoFile = (path: string): string => readFileSync(resolve(repoRoot, path), "utf8");

test("tsconfig uses Bun's current type entry", () => {
    const tsconfig = JSON.parse(readRepoFile("tsconfig.json")) as {
        compilerOptions?: {
            types?: string[];
        };
    };

    expect(tsconfig.compilerOptions?.types).toEqual(["bun", "node", "svelte"]);
});

test("test helper re-exports Svelte's public client api", async () => {
    const helper = await import("./helpers/svelte-client.ts");

    expect(typeof helper.flushSync).toBe("function");
    expect(typeof helper.svelteMount).toBe("function");
    expect(typeof helper.svelteUnmount).toBe("function");
});

test("builder Bun types use module imports instead of legacy namespace references", () => {
    const files = [
        "builder/finalize-css.ts",
        "builder/finalize-js.ts",
        "builder/build.ts",
        "builder/dev.ts",
        "builder/tests/finalize-js.test.ts",
    ];
    const legacyPatterns = [
        /\bBun\.BuildArtifact\b/,
        /\bBun\.BuildConfig\b/,
        /\bBun\.BunPlugin\b/,
        /\bBun\.Serve\.Options\b/,
        /\bBun\.Server</,
        /\bBun\.ErrorLike\b/,
    ];

    for (const file of files) {
        const source = readRepoFile(file);

        for (const pattern of legacyPatterns) {
            expect(pattern.test(source)).toBe(false);
        }
    }
});

test("tests use Svelte's public client API instead of internal source paths", () => {
    const files = [
        "route/tests/route-component.test.ts",
        "ui/swiper/Swiper.test.ts",
        "ui/sort-list-box/SortListBox.test.ts",
    ];
    const forbiddenPatterns = [
        /node_modules\/svelte\/src\/index-client\.js/,
        /node_modules\/svelte\/src\/internal\/client\/render\.js/,
        /node_modules\/svelte\/src\/internal\/client\/runtime\.js/,
    ];

    for (const file of files) {
        const source = readRepoFile(file);

        for (const pattern of forbiddenPatterns) {
            expect(pattern.test(source)).toBe(false);
        }
    }
});
