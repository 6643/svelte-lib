import { expect, test } from "bun:test";
import { join } from "node:path";

import { resolveDevWatchRoots } from "../dev";

test("resolveDevWatchRoots includes every configured assets directory", () => {
    const rootDir = join(process.cwd(), "tmp-dev-assets-root");
    const watchRoots = resolveDevWatchRoots(
        rootDir,
        [
            { dirName: "assets", physicalPath: join(rootDir, "assets") },
            { dirName: "public", physicalPath: join(rootDir, "public") },
        ],
        join(rootDir, "src", "App.svelte"),
    );

    expect(watchRoots.some((entry) => entry.path === join(rootDir, "assets") && entry.recursive)).toBe(true);
    expect(watchRoots.some((entry) => entry.path === join(rootDir, "public") && entry.recursive)).toBe(true);
});
