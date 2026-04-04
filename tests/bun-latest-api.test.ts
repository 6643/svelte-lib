import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
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

test("targeted public components no longer use slot markup or on: directives", () => {
    const files = [
        "ui/box/Block.svelte",
        "ui/input/StringInput.svelte",
        "ui/input/RangeInput.svelte",
        "ui/modal/FilledModal.svelte",
        "ui/swiper/Swiper.svelte",
        "ui/button/FilledButton.svelte",
        "ui/button/IconButton.svelte",
        "ui/button/TextButton.svelte",
        "ui/plyr/Plyr.svelte",
    ];

    for (const file of files) {
        const source = readRepoFile(file);

        expect(source.includes("<slot")).toBe(false);
        expect(/\son:[a-z]/.test(source)).toBe(false);
    }
});

test("builder README documents the intentional Svelte internal runtime boundary", () => {
    const readme = readRepoFile("builder/README.md");

    expect(readme.includes("svelte/internal/client")).toBe(true);
    expect(readme.includes("upgrade-sensitive boundary")).toBe(true);
    expect(readme.includes("bun run build")).toBe(true);
});

test("builder source config uses ts and local counters use arrow functions", () => {
    expect(existsSync(resolve(repoRoot, "builder/svelte.config.ts"))).toBe(true);
    expect(existsSync(resolve(repoRoot, "builder/svelte.config.js"))).toBe(false);

    const counterSource = readRepoFile("builder/src/lib/Counter.svelte");
    const counter2Source = readRepoFile("builder/src/lib/Counter2.svelte");

    expect(counterSource.includes("function increment")).toBe(false);
    expect(counter2Source.includes("function increment")).toBe(false);
    expect(/const increment = .*=>/.test(counterSource)).toBe(true);
    expect(/const increment = .*=>/.test(counter2Source)).toBe(true);
});
