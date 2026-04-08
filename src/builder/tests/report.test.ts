import { afterEach, expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { BuildArtifacts } from "../build";
import { formatBuildReport } from "../report";

const tempDirs: string[] = [];

afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((path) => rm(path, { force: true, recursive: true })));
});

test("formatBuildReport includes emitted shared chunks alongside the entry assets", async () => {
    const outDir = await mkdtemp(join(tmpdir(), "svelte-lib-builder-report-"));
    tempDirs.push(outDir);

    await writeFile(join(outDir, "entry.js"), 'console.log("entry");');
    await writeFile(join(outDir, "shared.js"), 'console.log("shared");');
    await writeFile(join(outDir, "app.css"), "body { color: teal; }");
    await writeFile(join(outDir, "index.html"), "<!doctype html>");

    const report = formatBuildReport({
        cssFile: "app.css",
        htmlFile: "index.html",
        jsFile: "entry.js",
        jsChunkFiles: ["shared.js"],
        outDir,
    } as BuildArtifacts & { jsChunkFiles: string[] });

    expect(report).toContain("Entry assets");
    expect(report).toContain("entry.js");
    expect(report).toContain("shared.js");
    expect(report).toContain("app.css");
    expect(report).toContain("index.html");
});
