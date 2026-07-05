import { expect, test } from "bun:test";
import { JSDOM } from "jsdom";

import { loadRuneModule } from "./load-rune-module.test-helper.ts";

const installDom = () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>", {
        url: "https://app.test/",
    });
    const globals = globalThis as any;
    globals.window = dom.window;
    globals.document = dom.window.document;

    return () => {
        dom.window.close();
        delete globals.window;
        delete globals.document;
    };
};

test("fullscreenState exposes fullscreen as rune state", async () => {
    const cleanup = installDom();
    const { fullscreenState } = await loadRuneModule<{
        fullscreenState: () => {
            isFullscreen: { value: boolean };
            toggleFullScreen: () => Promise<void>;
        };
    }>("./useFullScreen.svelte.ts", import.meta.url);

    const fullScreen = fullscreenState();

    expect(fullScreen.isFullscreen.value).toBe(false);
    expect(typeof fullScreen.toggleFullScreen).toBe("function");

    cleanup();
});
