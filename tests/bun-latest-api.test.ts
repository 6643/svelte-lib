import { expect, test } from "bun:test";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const repoRoot = resolve(import.meta.dir, "..");

const readRepoFile = (path: string): string => readFileSync(resolve(repoRoot, path), "utf8");
const readRepoTsconfig = () => {
    const tsconfigPath = resolve(repoRoot, "tsconfig.json");
    const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);

    if (configFile.error) {
        throw new Error(ts.formatDiagnostics([configFile.error], {
            getCanonicalFileName: (fileName) => fileName,
            getCurrentDirectory: () => repoRoot,
            getNewLine: () => "\n",
        }));
    }

    return configFile.config as {
        compilerOptions?: {
            types?: string[];
        };
    };
};

const listRepoFiles = (directory: string): string[] => {
    const root = resolve(repoRoot, directory);
    const entries = readdirSync(root, { recursive: true, withFileTypes: true });

    return entries
        .filter((entry) => entry.isFile())
        .map((entry) => resolve(directory, entry.parentPath.slice(root.length + 1), entry.name).replaceAll("\\", "/"));
};

test("tsconfig uses Bun's current type entry", () => {
    const tsconfig = readRepoTsconfig();

    expect(tsconfig.compilerOptions?.types).toEqual(["bun", "node", "svelte"]);
});

test("route and ui test helpers re-export Svelte's public client api", async () => {
    const routeHelper = await import("../src/route/tests/helpers.svelte-client.ts");
    const uiHelper = await import("../src/ui/tests/helpers.svelte-client.ts");

    expect(typeof routeHelper.flushSync).toBe("function");
    expect(typeof routeHelper.svelteMount).toBe("function");
    expect(typeof routeHelper.svelteUnmount).toBe("function");
    expect(typeof uiHelper.flushSync).toBe("function");
    expect(typeof uiHelper.svelteMount).toBe("function");
    expect(typeof uiHelper.svelteUnmount).toBe("function");
});

test("builder Bun types use module imports instead of legacy namespace references", () => {
    const files = [
        "src/builder/finalize-css.ts",
        "src/builder/finalize-js.ts",
        "src/builder/build.ts",
        "src/builder/dev.ts",
        "src/builder/tests/finalize-js.test.ts",
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

test("builder dev no longer documents a built-in proxy layer", () => {
    const source = readRepoFile("src/builder/dev.ts");
    const readme = readRepoFile("src/builder/README.md");

    expect(source.includes("PAGES_PROXY_URL")).toBe(false);
    expect(readme.includes("PAGES_PROXY_URL")).toBe(false);
});

test("builder README no longer documents app-local package imports or watcher polling fallback", () => {
    const source = readRepoFile("src/builder/dev.ts");
    const readme = readRepoFile("src/builder/README.md");

    expect(readme.includes("package.json#imports")).toBe(false);
    expect(source.includes("pollSnapshot")).toBe(false);
    expect(source.includes("isRecoverableDevWatcherSetupError")).toBe(false);
});

test("builder docs describe assetsDirs as the only static assets config", () => {
    const readme = readRepoFile("src/builder/README.md");
    const migration = readRepoFile("docs/migrations/2026-04-latest-svelte5-migration.md");

    expect(readme.includes("`assetsDirs`")).toBe(true);
    expect(readme.includes("`assetsDir`")).toBe(false);
    expect(readme.includes("builder.ts")).toBe(true);

    expect(migration.includes("assetsDirs")).toBe(true);
    expect(migration.includes("assetsDir")).toBe(true);
    expect(migration.includes("已移除")).toBe(true);
});

test("tests use Svelte's public client API instead of internal source paths", () => {
    const files = [
        "src/route/tests/route-component.test.ts",
        "src/ui/tests/Swiper.test.ts",
        "src/ui/tests/SortListBox.test.ts",
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

test("ui and route tests stay with their owning projects", () => {
    const expectedFiles = [
        "src/ui/tests/helpers.svelte-client.ts",
        "src/ui/tests/compile-svelte.ts",
        "src/ui/tests/snippet-components.test.ts",
        "src/ui/tests/fixtures/BlockHarness.svelte",
        "src/ui/tests/fixtures/FilledModalHarness.svelte",
        "src/ui/tests/fixtures/RangeInputHarness.svelte",
        "src/ui/tests/fixtures/StringInputHarness.svelte",
        "src/ui/tests/fixtures/SortListBoxHarness.svelte",
        "src/ui/tests/fixtures/SwiperHarness.svelte",
        "src/ui/tests/Swiper.test.ts",
        "src/ui/tests/Swiper.bundle-loader.test.ts",
        "src/ui/tests/Swiper.video-autoplay.test.ts",
        "src/ui/tests/SortListBox.test.ts",
        "src/ui/tests/SortListBox.drag-layout.test.ts",
        "src/ui/tests/SortListBox.reorder.test.ts",
        "src/route/tests/helpers.svelte-client.ts",
        "src/route/tests/compile-svelte.ts",
        "src/route/tests/public-api.test.ts",
        "src/route/tests/query-navigation-history.test.ts",
        "src/route/tests/route-component.test.ts",
        "src/route/tests/router-runtime.test.ts",
        "src/route/tests/fixtures/LazyTarget.svelte",
        "src/route/tests/fixtures/MutableRouteDecoderHarness.svelte",
        "src/route/tests/fixtures/MutableRouteHarness.svelte",
        "src/route/tests/fixtures/MutableRoutePathHarness.svelte",
        "src/route/tests/fixtures/NotFound.svelte",
        "src/route/tests/fixtures/SyncA.svelte",
        "src/route/tests/fixtures/SyncB.svelte",
        "src/route/tests/fixtures/lifecycle.ts",
    ];

    const removedPaths = [
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

    for (const path of expectedFiles) {
        expect(existsSync(resolve(repoRoot, path))).toBe(true);
    }

    for (const path of removedPaths) {
        expect(existsSync(resolve(repoRoot, path))).toBe(false);
    }
});

test("README documents the repository test layout policy", () => {
    const readme = readRepoFile("README.md");

    expect(readme.includes("## 测试布局")).toBe(true);
    expect(readme.includes("默认就近")).toBe(true);
    expect(readme.includes("根 `tests/` 只保留仓库级、包级和公开 API 契约测试")).toBe(true);
});

test("targeted public components no longer use slot markup or on: directives", () => {
    const files = [
        "src/ui/Button.filled.svelte",
        "src/ui/Button.icon.svelte",
        "src/ui/Button.text.svelte",
        "src/ui/Block.svelte",
        "src/ui/Input.range.svelte",
        "src/ui/Input.string.svelte",
        "src/ui/Modal.filled.svelte",
        "src/ui/Plyr.svelte",
        "src/ui/SortListBox.svelte",
        "src/ui/Swiper.svelte",
    ];

    for (const file of files) {
        const source = readRepoFile(file);

        expect(source.includes("<slot")).toBe(false);
        expect(/\son:[a-z]/.test(source)).toBe(false);
    }
});

test("ui modernization removes export let and reactive label syntax", () => {
    const files = [
        "src/ui/Block.svelte",
        "src/ui/Button.filled.svelte",
        "src/ui/Button.icon.svelte",
        "src/ui/Button.text.svelte",
        "src/ui/Input.range.svelte",
        "src/ui/Input.string.svelte",
        "src/ui/Modal.filled.svelte",
        "src/ui/Plyr.svelte",
        "src/ui/Swiper.svelte",
    ];
    const forbiddenPatterns = [/\bexport let\b/, /\n\s*\$:\s/];

    for (const file of files) {
        const source = readRepoFile(file);

        for (const pattern of forbiddenPatterns) {
            expect(pattern.test(source)).toBe(false);
        }
    }
});

test("theme api now lives in ui and useTheme is removed", () => {
    const uiEntry = readRepoFile("src/ui/_.ts");
    const useEntry = readRepoFile("src/use/_.ts");

    expect(existsSync(resolve(repoRoot, "src/ui/theme.ts"))).toBe(true);
    expect(existsSync(resolve(repoRoot, "src/use/useTheme.ts"))).toBe(false);
    expect(existsSync(resolve(repoRoot, "src/use/useTheme.test.ts"))).toBe(false);
    expect(uiEntry.includes('./theme.ts')).toBe(true);
    expect(useEntry.includes("./useTheme.ts")).toBe(false);
});

test("route modernization removes legacy component syntax", () => {
    const files = ["src/route/Route.svelte"];
    const forbiddenPatterns = [/\bexport let\b/, /\n\s*\$:\s/, /\bonMount\b/];

    for (const file of files) {
        const source = readRepoFile(file);

        for (const pattern of forbiddenPatterns) {
            expect(pattern.test(source)).toBe(false);
        }
    }
});

test("builder modernization stays in runtime/support-code scope because builder owns no Svelte components", () => {
    // Builder modernization in this repository targets runtime and support code.
    // There are no maintained builder-owned .svelte files left in scope to apply a component-syntax cleanup against.
    const builderSvelteFiles = listRepoFiles("src/builder").filter((path) => path.endsWith(".svelte"));

    expect(builderSvelteFiles).toEqual([]);
});

test("ui runtime files are flattened and button variants use the Button.* naming scheme", () => {
    const expectedFiles = [
        "src/ui/Block.svelte",
        "src/ui/Button.filled.svelte",
        "src/ui/Button.icon.svelte",
        "src/ui/Button.text.svelte",
        "src/ui/Input.range.svelte",
        "src/ui/Input.string.svelte",
        "src/ui/Modal.filled.svelte",
        "src/ui/Plyr.svelte",
        "src/ui/SortListBox.svelte",
        "src/ui/SortListBox.drag-layout.ts",
        "src/ui/SortListBox.reorder.ts",
        "src/ui/Swiper.svelte",
        "src/ui/Swiper.bundle-loader.ts",
        "src/ui/Swiper.video-autoplay.ts",
    ];

    const removedPaths = [
        "src/ui/box/Block.svelte",
        "src/ui/button/FilledButton.svelte",
        "src/ui/button/IconButton.svelte",
        "src/ui/button/TextButton.svelte",
        "src/ui/input/RangeInput.svelte",
        "src/ui/input/StringInput.svelte",
        "src/ui/modal/FilledModal.svelte",
        "src/ui/plyr/Plyr.svelte",
        "src/ui/sort-list-box/SortListBox.svelte",
        "src/ui/sort-list-box/drag-layout.ts",
        "src/ui/sort-list-box/reorder.ts",
        "src/ui/swiper/Swiper.svelte",
        "src/ui/swiper/swiper-bundle-loader.ts",
        "src/ui/swiper/video-autoplay.ts",
    ];

    for (const path of expectedFiles) {
        expect(existsSync(resolve(repoRoot, path))).toBe(true);
    }

    for (const path of removedPaths) {
        expect(existsSync(resolve(repoRoot, path))).toBe(false);
    }
});

test("builder README documents the intentional Svelte internal runtime boundary", () => {
    const readme = readRepoFile("src/builder/README.md");

    expect(readme.includes("svelte/internal/client")).toBe(true);
    expect(readme.includes("升级敏感边界")).toBe(true);
    expect(readme.includes("bun run build")).toBe(true);
});

test("builder docs use the published CLI command names consistently", () => {
    const builderReadme = readRepoFile("src/builder/README.md");
    const migration = readRepoFile("docs/migrations/2026-04-latest-svelte5-migration.md");

    expect(builderReadme.includes("svelte-build")).toBe(true);
    expect(builderReadme.includes("svelte-dev")).toBe(true);
    expect(builderReadme.includes("svelte-builder-build")).toBe(false);
    expect(builderReadme.includes("svelte-builder-dev")).toBe(false);

    expect(migration.includes("svelte-build")).toBe(true);
    expect(migration.includes("svelte-builder-build")).toBe(false);
});

test("migration guide documents the builder CLI rename as a breaking change", () => {
    const migration = readRepoFile("docs/migrations/2026-04-latest-svelte5-migration.md");

    expect(migration.includes("svelte-builder build")).toBe(true);
    expect(migration.includes("svelte-builder dev")).toBe(true);
    expect(migration.includes("svelte-build")).toBe(true);
    expect(migration.includes("svelte-dev")).toBe(true);
});

test("builder README no longer points readers at a removed top-level demo app", () => {
    const readme = readRepoFile("src/builder/README.md");

    expect(readme.includes("顶层 `demo/`")).toBe(false);
    expect(readme.includes("不再维护顶层样例 app")).toBe(true);
});

test("builder dev runtime logs use the published dev command name", () => {
    const devSource = readRepoFile("src/builder/dev.ts");
    const reloadSource = readRepoFile("src/builder/dev-reload.ts");

    expect(devSource.includes("[svelte-builder]")).toBe(false);
    expect(devSource.includes("[svelte-dev]") || reloadSource.includes("[svelte-dev]")).toBe(true);
});

test("root README no longer documents a removed top-level demo app", () => {
    const readme = readRepoFile("README.md");

    expect(readme.includes("## Demo")).toBe(false);
    expect(readme.includes("demo/README.md")).toBe(false);
    expect(readme.includes("svelte-lib/demo")).toBe(false);
});

test("builder source config uses ts and local counters use arrow functions", () => {
    expect(existsSync(resolve(repoRoot, "src/builder/svelte.config.ts"))).toBe(true);
    expect(existsSync(resolve(repoRoot, "src/builder/svelte.config.js"))).toBe(false);
    expect(existsSync(resolve(repoRoot, "src/builder/demo.Counter.svelte"))).toBe(false);
    expect(existsSync(resolve(repoRoot, "src/builder/demo.Counter2.svelte"))).toBe(false);
    expect(existsSync(resolve(repoRoot, "src/builder/src/lib/Counter.svelte"))).toBe(false);
    expect(existsSync(resolve(repoRoot, "src/builder/src/lib/Counter2.svelte"))).toBe(false);
});
