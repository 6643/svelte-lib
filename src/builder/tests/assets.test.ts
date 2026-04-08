import { expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { resolveAssetPath, resolveConfiguredAssetsDirs } from "../assets";

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

test("resolveConfiguredAssetsDirs fails when an explicit assets directory does not exist", async () => {
    const result = await resolveConfiguredAssetsDirs(process.cwd(), ["nonexistent-assets"]);
    expect(result.ok).toBe(false);
    if (result.ok) {
        throw new Error("Expected an explicit missing assetsDirs entry to fail");
    }
    expect(result.error.includes("Missing configured assets directory")).toBe(true);
});

test("resolveConfiguredAssetsDirs allows a missing default assets directory", async () => {
    const result = await resolveConfiguredAssetsDirs(process.cwd(), undefined, "nonexistent-assets");
    expect(result.ok).toBe(true);
    if (!result.ok) {
        throw new Error(result.error);
    }
    expect(result.value).toEqual([]);
});

test("resolveConfiguredAssetsDirs resolves multiple configured directories", async () => {
    const rootDir = join("/tmp", `svelte-builder-assets-${Date.now()}-${Math.random().toString(16).slice(2)}`);

    await mkdir(join(rootDir, "assets"), { recursive: true });
    await mkdir(join(rootDir, "public"), { recursive: true });

    try {
        const result = await resolveConfiguredAssetsDirs(rootDir, ["assets", "public"]);
        expect(result.ok).toBe(true);
        if (!result.ok) {
            throw new Error(result.error);
        }

        expect(result.value.map((entry) => entry.dirName)).toEqual(["assets", "public"]);
    } finally {
        await rm(rootDir, { recursive: true, force: true });
    }
});

test("resolveConfiguredAssetsDirs rejects duplicate final directory names", async () => {
    const rootDir = join("/tmp", `svelte-builder-assets-dup-${Date.now()}-${Math.random().toString(16).slice(2)}`);

    await mkdir(join(rootDir, "assets"), { recursive: true });

    try {
        const result = await resolveConfiguredAssetsDirs(rootDir, ["assets", "./assets"]);
        expect(result.ok).toBe(false);
        if (result.ok) {
            throw new Error("Expected duplicate assetsDirs names to be rejected");
        }

        expect(result.error.includes("Duplicate assets directory name")).toBe(true);
    } finally {
        await rm(rootDir, { recursive: true, force: true });
    }
});
