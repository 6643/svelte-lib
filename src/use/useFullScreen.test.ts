import { afterEach, expect, test } from "bun:test";
import { get } from "svelte/store";

const loadUseFullScreenModule = async (): Promise<typeof import("./useFullScreen.ts")> =>
    import(new URL(`./useFullScreen.ts?test=${Date.now()}-${Math.random()}`, import.meta.url).href) as Promise<
        typeof import("./useFullScreen.ts")
    >;

afterEach(() => {
    globalThis.document = undefined as never;
});

test("useFullScreen registers a single global listener and shares fullscreen state", async () => {
    const previousDocument = globalThis.document;
    const listeners: Array<() => void> = [];
    const documentStub = {
        fullscreenElement: null as unknown,
        addEventListener: (type: string, listener: () => void) => {
            if (type === "fullscreenchange") {
                listeners.push(listener);
            }
        },
        documentElement: {
            requestFullscreen: async () => undefined,
        },
        exitFullscreen: async () => undefined,
    };

    globalThis.document = documentStub as never;

    const { useFullScreen } = await loadUseFullScreenModule();
    const first = useFullScreen();
    const second = useFullScreen();

    expect(listeners.length).toBe(1);

    documentStub.fullscreenElement = {};
    listeners[0]?.();

    expect(get(first.isFullscreen)).toBe(true);
    expect(get(second.isFullscreen)).toBe(true);

    globalThis.document = previousDocument;
});
