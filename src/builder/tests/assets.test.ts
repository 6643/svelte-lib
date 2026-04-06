// @ts-nocheck
import { expect, test } from "bun:test";
import { join } from "node:path";
import { resolveAssetPath, resolveConfiguredAssetsDir } from "../assets";

test("resolveAssetPath dev assets keeps asset subpaths inside the configured assets root", () => {
    const assetsRoot = join(process.cwd(), "tmp-assets-root");
    const result = resolveAssetPath(assetsRoot, "images/banner.txt");

    expect(result.ok).toBe(true);

    if (!result.ok) {
        throw new Error(result.error);
    }

    expect(result.value).toBe(join(assetsRoot, "images", "banner.txt"));
});

test("resolveAssetPath rejects traversal attempts outside the assets root", () => {
    const assetsRoot = join(process.cwd(), "tmp-assets-root");

    const parentEscape = resolveAssetPath(assetsRoot, "../package.json");
    const nestedEscape = resolveAssetPath(assetsRoot, "icons/../../package.json");

    expect(parentEscape.ok).toBe(false);
    expect(nestedEscape.ok).toBe(false);

    if (parentEscape.ok || nestedEscape.ok) {
        throw new Error("Expected traversal attempts to be rejected");
    }

    expect(parentEscape.error).toContain("escapes assets root");
    expect(nestedEscape.error).toContain("escapes assets root");
});

test("resolveConfiguredAssetsDir fails when an explicit assets directory does not exist", async () => {
    const result = await resolveConfiguredAssetsDir(process.cwd(), "nonexistent-assets");
    expect(result.ok).toBe(false);
    if (result.ok) {
        throw new Error("Expected an explicit missing assetsDir to fail");
    }
    expect(result.error.includes("Missing configured assets directory")).toBe(true);
});

test("resolveConfiguredAssetsDir allows a missing default assets directory", async () => {
    const result = await resolveConfiguredAssetsDir(process.cwd(), undefined, "nonexistent-assets");
    expect(result.ok).toBe(true);
    if (!result.ok) {
        throw new Error(result.error);
    }
    expect(result.value).toBeUndefined();
});
