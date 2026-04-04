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
    const helper = await import("./helpers.svelte-client.ts");

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
        "tests/route.route-component.test.ts",
        "tests/ui.Swiper.test.ts",
        "tests/ui.SortListBox.test.ts",
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

test("ui and route tests are flattened into the root tests directory", () => {
    const expectedFiles = [
        "tests/helpers.svelte-client.ts",
        "tests/ui.snippet-components.test.ts",
        "tests/ui.fixture.BlockHarness.svelte",
        "tests/ui.fixture.FilledModalHarness.svelte",
        "tests/ui.fixture.RangeInputHarness.svelte",
        "tests/ui.fixture.StringInputHarness.svelte",
        "tests/ui.fixture.SortListBoxHarness.svelte",
        "tests/ui.fixture.SwiperHarness.svelte",
        "tests/ui.Swiper.test.ts",
        "tests/ui.Swiper.bundle-loader.test.ts",
        "tests/ui.Swiper.video-autoplay.test.ts",
        "tests/ui.SortListBox.test.ts",
        "tests/ui.SortListBox.drag-layout.test.ts",
        "tests/ui.SortListBox.reorder.test.ts",
        "tests/route.public-api.test.ts",
        "tests/route.query-navigation-history.test.ts",
        "tests/route.route-component.test.ts",
        "tests/route.router-runtime.test.ts",
        "tests/route.helper.compile-svelte.ts",
        "tests/route.fixture.LazyTarget.svelte",
        "tests/route.fixture.MutableRouteDecoderHarness.svelte",
        "tests/route.fixture.MutableRouteHarness.svelte",
        "tests/route.fixture.MutableRoutePathHarness.svelte",
        "tests/route.fixture.NotFound.svelte",
        "tests/route.fixture.SyncA.svelte",
        "tests/route.fixture.SyncB.svelte",
        "tests/route.fixture.lifecycle.ts",
    ];

    const removedPaths = [
        "tests/helpers/svelte-client.ts",
        "ui/tests/snippet-components.test.ts",
        "ui/tests/fixtures/BlockHarness.svelte",
        "ui/tests/fixtures/FilledModalHarness.svelte",
        "ui/tests/fixtures/RangeInputHarness.svelte",
        "ui/tests/fixtures/StringInputHarness.svelte",
        "ui/sort-list-box/tests/fixtures/SortListBoxHarness.svelte",
        "ui/tests/fixtures/SwiperHarness.svelte",
        "ui/swiper/Swiper.test.ts",
        "ui/swiper/swiper-bundle-loader.test.ts",
        "ui/swiper/video-autoplay.test.ts",
        "ui/sort-list-box/SortListBox.test.ts",
        "ui/sort-list-box/drag-layout.test.ts",
        "ui/sort-list-box/reorder.test.ts",
        "route/tests/public-api.test.ts",
        "route/tests/query-navigation-history.test.ts",
        "route/tests/route-component.test.ts",
        "route/tests/router-runtime.test.ts",
        "route/tests/helpers/compile-svelte.ts",
        "route/tests/fixtures/LazyTarget.svelte",
        "route/tests/fixtures/MutableRouteDecoderHarness.svelte",
        "route/tests/fixtures/MutableRouteHarness.svelte",
        "route/tests/fixtures/MutableRoutePathHarness.svelte",
        "route/tests/fixtures/NotFound.svelte",
        "route/tests/fixtures/SyncA.svelte",
        "route/tests/fixtures/SyncB.svelte",
        "route/tests/fixtures/lifecycle.ts",
    ];

    for (const path of expectedFiles) {
        expect(existsSync(resolve(repoRoot, path))).toBe(true);
    }

    for (const path of removedPaths) {
        expect(existsSync(resolve(repoRoot, path))).toBe(false);
    }
});

test("targeted public components no longer use slot markup or on: directives", () => {
    const files = [
        "ui/Button.filled.svelte",
        "ui/Button.icon.svelte",
        "ui/Button.text.svelte",
        "ui/Block.svelte",
        "ui/Input.range.svelte",
        "ui/Input.string.svelte",
        "ui/Modal.filled.svelte",
        "ui/Plyr.svelte",
        "ui/SortListBox.svelte",
        "ui/Swiper.svelte",
    ];

    for (const file of files) {
        const source = readRepoFile(file);

        expect(source.includes("<slot")).toBe(false);
        expect(/\son:[a-z]/.test(source)).toBe(false);
    }
});

test("ui runtime files are flattened and button variants use the Button.* naming scheme", () => {
    const expectedFiles = [
        "ui/Block.svelte",
        "ui/Button.filled.svelte",
        "ui/Button.icon.svelte",
        "ui/Button.text.svelte",
        "ui/Input.range.svelte",
        "ui/Input.string.svelte",
        "ui/Modal.filled.svelte",
        "ui/Plyr.svelte",
        "ui/SortListBox.svelte",
        "ui/SortListBox.drag-layout.ts",
        "ui/SortListBox.reorder.ts",
        "ui/Swiper.svelte",
        "ui/Swiper.bundle-loader.ts",
        "ui/Swiper.video-autoplay.ts",
    ];

    const removedPaths = [
        "ui/box/Block.svelte",
        "ui/button/FilledButton.svelte",
        "ui/button/IconButton.svelte",
        "ui/button/TextButton.svelte",
        "ui/input/RangeInput.svelte",
        "ui/input/StringInput.svelte",
        "ui/modal/FilledModal.svelte",
        "ui/plyr/Plyr.svelte",
        "ui/sort-list-box/SortListBox.svelte",
        "ui/sort-list-box/drag-layout.ts",
        "ui/sort-list-box/reorder.ts",
        "ui/swiper/Swiper.svelte",
        "ui/swiper/swiper-bundle-loader.ts",
        "ui/swiper/video-autoplay.ts",
    ];

    for (const path of expectedFiles) {
        expect(existsSync(resolve(repoRoot, path))).toBe(true);
    }

    for (const path of removedPaths) {
        expect(existsSync(resolve(repoRoot, path))).toBe(false);
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
    expect(existsSync(resolve(repoRoot, "builder/demo.Counter.svelte"))).toBe(false);
    expect(existsSync(resolve(repoRoot, "builder/demo.Counter2.svelte"))).toBe(false);
    expect(existsSync(resolve(repoRoot, "builder/src/lib/Counter.svelte"))).toBe(false);
    expect(existsSync(resolve(repoRoot, "builder/src/lib/Counter2.svelte"))).toBe(false);
});
