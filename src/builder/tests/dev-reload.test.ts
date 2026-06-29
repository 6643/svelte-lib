import { describe, expect, it } from "bun:test";
import { shouldProcessDevWatchEvent, formatDevWatcherIssue } from "../dev";

describe("dev-reload", () => {
    describe("shouldProcessDevWatchEvent", () => {
        it("should process first event", () => {
            const events = new Map<string, number>();
            expect(shouldProcessDevWatchEvent(events, "src/App.svelte", 1000)).toBe(true);
        });

        it("should debounce rapid duplicate events", () => {
            const events = new Map<string, number>();
            const now = 1000;

            expect(shouldProcessDevWatchEvent(events, "src/App.svelte", now)).toBe(true);
            expect(shouldProcessDevWatchEvent(events, "src/App.svelte", now + 50)).toBe(false);
        });

        it("should allow events after debounce window", () => {
            const events = new Map<string, number>();
            const now = 1000;

            expect(shouldProcessDevWatchEvent(events, "src/App.svelte", now)).toBe(true);
            expect(shouldProcessDevWatchEvent(events, "src/App.svelte", now + 200)).toBe(true);
        });

        it("should clean up stale events", () => {
            const events = new Map<string, number>([["stale/file.ts", 500]]);
            shouldProcessDevWatchEvent(events, "src/App.svelte", 1000);

            expect(events.has("stale/file.ts")).toBe(false);
        });
    });

    describe("formatDevWatcherIssue", () => {
        it("should return undefined for ENOENT errors", () => {
            const error = Object.assign(new Error("ENOENT"), { code: "ENOENT" });
            expect(formatDevWatcherIssue("test", error)).toBeUndefined();
        });

        it("should return undefined for ENOTDIR errors", () => {
            const error = Object.assign(new Error("ENOTDIR"), { code: "ENOTDIR" });
            expect(formatDevWatcherIssue("test", error)).toBeUndefined();
        });

        it("should return formatted message for other errors", () => {
            const error = new Error("Something went wrong");
            const result = formatDevWatcherIssue("watch setup", error);
            expect(result).toContain("watch setup");
            expect(result).toContain("Something went wrong");
        });
    });
});
