import { expect, test } from "bun:test";

import type { BuildArtifacts, Result } from "../build";
import * as buildModule from "../build";
import * as devModule from "../dev";

test("build module owns its CLI entry behavior", async () => {
    const runBuildCli = (buildModule as Record<string, unknown>).runBuildCli;
    expect(typeof runBuildCli).toBe("function");
    if (typeof runBuildCli !== "function") {
        return;
    }

    const logs: string[] = [];
    const errors: string[] = [];
    const artifacts: BuildArtifacts = {
        cssFile: "app.css",
        htmlFile: "index.html",
        jsFile: "app.js",
        outDir: "dist",
    };
    const formatted = "formatted build report";
    const exitCode = await runBuildCli({
        cwd: "/tmp/project",
        error: (message: string) => errors.push(message),
        format: (value: BuildArtifacts) => {
            expect(value).toEqual(artifacts);
            return formatted;
        },
        log: (message: string) => logs.push(message),
        run: async (cwd: string): Promise<Result<BuildArtifacts>> => {
            expect(cwd).toBe("/tmp/project");
            return { ok: true, value: artifacts };
        },
    });

    expect(exitCode).toBe(0);
    expect(logs).toEqual([formatted]);
    expect(errors).toEqual([]);
});

test("dev module owns its CLI entry behavior", async () => {
    const runDevCli = (devModule as Record<string, unknown>).runDevCli;
    expect(typeof runDevCli).toBe("function");
    if (typeof runDevCli !== "function") {
        return;
    }

    const logs: string[] = [];
    const errors: string[] = [];
    const exitCode = await runDevCli({
        cwd: "/tmp/project",
        error: (message: string) => errors.push(message),
        log: (message: string) => logs.push(message),
        run: async (cwd: string) => {
            expect(cwd).toBe("/tmp/project");
            return {
                ok: true,
                value: {
                    port: 4321,
                    stop: async () => {},
                },
            };
        },
    });

    expect(exitCode).toBe(0);
    expect(logs).toEqual(["Serving http://localhost:4321"]);
    expect(errors).toEqual([]);
});
