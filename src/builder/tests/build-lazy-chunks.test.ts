import { afterEach, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { buildSvelte } from "../build";

const tempDirs: string[] = [];

afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((rootDir) => rm(rootDir, { recursive: true, force: true })));
});

test("buildSvelte reports emitted chunks for lazy route components", async () => {
    const rootDir = join(
        process.cwd(),
        "src/builder/tests",
        `.tmp-build-lazy-chunks-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    );
    tempDirs.push(rootDir);

    await mkdir(join(rootDir, "src", "routes"), { recursive: true });
    await writeFile(
        join(rootDir, "src", "App.svelte"),
        `<script lang="ts">
    import { Route } from "svelte-lib/route";
    import Home from "./routes/Home.svelte";
</script>

<Route path="/" component={Home} />
<Route path="/lazy" component={() => import("./routes/Lazy.svelte")} />
`,
        "utf8",
    );
    await writeFile(join(rootDir, "src", "routes", "Home.svelte"), "<p>home</p>\n", "utf8");
    await writeFile(join(rootDir, "src", "routes", "Lazy.svelte"), "<p>lazy</p>\n", "utf8");

    const result = await buildSvelte({
        appComponent: "src/App.svelte",
        outDir: "dist",
        rootDir,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
        throw new Error(result.error);
    }

    expect((result.value.jsChunkFiles?.length ?? 0) > 0).toBe(true);
    expect(/^[0-9a-f]{8}\.js$/.test(result.value.jsFile)).toBe(true);
    for (const file of result.value.jsChunkFiles ?? []) {
        expect(/^[0-9a-f]{8}\.js$/.test(file)).toBe(true);
        expect(existsSync(join(result.value.outDir, file))).toBe(true);
    }
    expect(/^[0-9a-f]{8}\.css$/.test(result.value.cssFile)).toBe(true);
});

test("buildSvelte copies multiple static asset directories by directory name", async () => {
    const rootDir = join(
        process.cwd(),
        "src/builder/tests",
        `.tmp-build-assets-dirs-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    );
    tempDirs.push(rootDir);

    await mkdir(join(rootDir, "src"), { recursive: true });
    await mkdir(join(rootDir, "assets"), { recursive: true });
    await mkdir(join(rootDir, "public"), { recursive: true });
    await writeFile(join(rootDir, "src", "App.svelte"), "<p>app</p>\n", "utf8");
    await writeFile(join(rootDir, "assets", "logo.svg"), "<svg></svg>\n", "utf8");
    await writeFile(join(rootDir, "public", "robots.txt"), "User-agent: *\n", "utf8");

    const result = await buildSvelte({
        appComponent: "src/App.svelte",
        assetsDirs: ["assets", "public"],
        outDir: "dist",
        rootDir,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
        throw new Error(result.error);
    }

    expect(existsSync(join(result.value.outDir, "assets", "logo.svg"))).toBe(true);
    expect(existsSync(join(result.value.outDir, "public", "robots.txt"))).toBe(true);
});
