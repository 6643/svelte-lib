import { expect, test } from "bun:test";

import type { BuildArtifacts } from "../build";
import * as buildModule from "../build";
import * as devModule from "../dev";

test("build module exposes the core build entry", async () => {
    const buildEntrypoint = (buildModule as Record<string, unknown>).build;
    expect(typeof buildEntrypoint).toBe("function");
    if (typeof buildEntrypoint !== "function") {
        return;
    }

    const result = await buildEntrypoint({
        rootDir: "/tmp/project",
    });

    expect(result.ok).toBe(false);
});

test("dev module exposes the core serve entry", async () => {
    const serveEntrypoint = (devModule as Record<string, unknown>).serve;
    expect(typeof serveEntrypoint).toBe("function");
    if (typeof serveEntrypoint !== "function") {
        return;
    }

    const result = await serveEntrypoint({
        cwd: "/tmp/project",
    });

    expect(result.ok).toBe(false);
});
