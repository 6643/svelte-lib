import { afterEach, expect, test } from "bun:test";
import { JSDOM } from "jsdom";

import {
    SWIPER_BUNDLE_INTEGRITY,
    SWIPER_BUNDLE_URL,
    __resetSwiperBundleLoaderForTest,
    createSwiperBundleScript,
    ensureSwiperBundleLoaded,
} from "./swiper-bundle-loader.ts";

afterEach(() => {
    __resetSwiperBundleLoaderForTest();
});

test("createSwiperBundleScript pins the bundle url and integrity", () => {
    const { window } = new JSDOM("<!doctype html><html><head></head><body></body></html>");
    const script = createSwiperBundleScript(window.document);

    expect(script.src).toBe(SWIPER_BUNDLE_URL);
    expect(script.integrity).toBe(SWIPER_BUNDLE_INTEGRITY);
    expect(script.crossOrigin).toBe("anonymous");
    expect(script.dataset.swiperBundle).toBe("true");
});

test("ensureSwiperBundleLoaded single-flights concurrent script loads", async () => {
    const { window } = new JSDOM("<!doctype html><html><head></head><body></body></html>");
    const appendedScripts: HTMLScriptElement[] = [];
    const originalAppendChild = window.document.head.appendChild.bind(window.document.head);

    Object.defineProperty(window, "customElements", {
        configurable: true,
        value: {
            get: () => undefined,
        },
    });

    window.document.head.appendChild = ((node: Node) => {
        if (node instanceof window.HTMLScriptElement) {
            appendedScripts.push(node);
        }
        return originalAppendChild(node);
    }) as typeof window.document.head.appendChild;

    const firstLoad = ensureSwiperBundleLoaded(window, window.document);
    const secondLoad = ensureSwiperBundleLoaded(window, window.document);

    expect(appendedScripts.length).toBe(1);

    appendedScripts[0].dispatchEvent(new window.Event("load"));
    await Promise.all([firstLoad, secondLoad]);
});
