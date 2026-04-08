import { expect, test } from "bun:test";

import * as devModule from "../dev";

const { classifyDevWatchTarget } = devModule;

test("classifyDevWatchTarget marks missing watched files as reloadable modules", () => {
    const result = classifyDevWatchTarget({
        eventPath: "/app/src/App.svelte",
        fileStatus: "missing",
        filename: "App.svelte",
        watchDir: "/app",
    });

    expect(result).toEqual({
        kind: "module",
        modulePath: "src/App.svelte",
    });
});

test("classifyDevWatchTarget detects config file changes before filesystem lookup", () => {
    const result = classifyDevWatchTarget({
        eventPath: "/app/builder.ts",
        fileStatus: "missing",
        filename: "builder.ts",
        watchDir: "/app",
    });

    expect(result).toEqual({
        kind: "config",
    });
});

test("classifyDevWatchTarget ignores paths outside the watch root", () => {
    const result = classifyDevWatchTarget({
        eventPath: "/elsewhere/App.svelte",
        fileStatus: "missing",
        filename: "App.svelte",
        watchDir: "/app",
    });

    expect(result).toEqual({
        kind: "ignore",
    });
});

test("builder dev no longer exports a watcher polling fallback helper", () => {
    expect("isRecoverableDevWatcherSetupError" in devModule).toBe(false);
});
