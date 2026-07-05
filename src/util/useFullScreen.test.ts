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

test("fullscreen helpers expose current state and fullscreen actions", async () => {
    const cleanup = installDom();
    const { isFullscreen, setFullscreen, toggleFullscreen } = await loadRuneModule<{
        isFullscreen: () => boolean;
        setFullscreen: (enabled: boolean) => Promise<void>;
        toggleFullscreen: () => Promise<void>;
    }>("./useFullScreen.svelte.ts", import.meta.url);
    let requested = false;
    document.documentElement.requestFullscreen = async () => {
        requested = true;
    };

    expect(isFullscreen()).toBe(false);
    expect(typeof setFullscreen).toBe("function");
    expect(typeof toggleFullscreen).toBe("function");

    await setFullscreen(true);

    expect(requested).toBe(true);

    cleanup();
});
