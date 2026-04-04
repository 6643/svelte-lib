import { afterEach, beforeEach, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { loadCompiledComponent } from "./route.helper.compile-svelte.ts";
import { flushSync, svelteMount, svelteUnmount } from "./helpers.svelte-client.ts";

let cleanupDom = () => {};

const installDom = () => {
    const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", {
        url: "https://app.test/",
    });

    const previous = {
        CustomEvent: globalThis.CustomEvent,
        document: globalThis.document,
        Element: globalThis.Element,
        Event: globalThis.Event,
        HTMLElement: globalThis.HTMLElement,
        Node: globalThis.Node,
        Text: globalThis.Text,
        SVGElement: globalThis.SVGElement,
        window: globalThis.window,
    };

    globalThis.window = dom.window as never;
    globalThis.document = dom.window.document as never;
    globalThis.Element = dom.window.Element as never;
    globalThis.Event = dom.window.Event as never;
    globalThis.HTMLElement = dom.window.HTMLElement as never;
    globalThis.Node = dom.window.Node as never;
    globalThis.Text = dom.window.Text as never;
    globalThis.SVGElement = dom.window.SVGElement as never;
    globalThis.CustomEvent = dom.window.CustomEvent as never;

    return () => {
        globalThis.window = previous.window;
        globalThis.document = previous.document;
        globalThis.Element = previous.Element;
        globalThis.Event = previous.Event;
        globalThis.HTMLElement = previous.HTMLElement;
        globalThis.Node = previous.Node;
        globalThis.Text = previous.Text;
        globalThis.SVGElement = previous.SVGElement;
        globalThis.CustomEvent = previous.CustomEvent;
        dom.window.close();
    };
};

beforeEach(() => {
    cleanupDom = installDom();
});

afterEach(() => {
    cleanupDom();
});

test("Swiper does not attach listeners after it unmounts before async setup completes", async () => {
    const Swiper = await loadCompiledComponent("./ui/Swiper.svelte");
    const target = document.createElement("div");
    document.body.append(target);

    let resolveWhenDefined: (() => void) | undefined;
    const appendedScripts: HTMLScriptElement[] = [];
    const originalAppendChild = document.head.appendChild.bind(document.head);
    const onCalls: string[] = [];

    Object.defineProperty(window, "customElements", {
        configurable: true,
        value: {
            get: () => undefined,
            whenDefined: () =>
                new Promise<void>((resolve) => {
                    resolveWhenDefined = resolve;
                }),
        },
    });

    document.head.appendChild = ((node: Node) => {
        if (node instanceof window.HTMLScriptElement) {
            appendedScripts.push(node);
        }
        return originalAppendChild(node);
    }) as typeof document.head.appendChild;

    const mounted = svelteMount(Swiper, { target });
    flushSync();

    const swiperEl = target.querySelector("swiper-container") as HTMLElement & {
        swiper?: {
            autoplay?: { start?: () => void; stop?: () => void };
            off?: (event: string, handler: () => void) => void;
            on?: (event: string, handler: () => void) => void;
            params?: { autoplay?: { enabled?: boolean } };
            slides: HTMLElement[];
        };
    };
    if (!swiperEl) {
        throw new Error("Missing swiper element");
    }

    swiperEl.swiper = {
        autoplay: {},
        off: () => undefined,
        on: (event) => {
            onCalls.push(event);
        },
        params: { autoplay: { enabled: true } },
        slides: [],
    };

    svelteUnmount(mounted);
    flushSync();

    appendedScripts[0]?.dispatchEvent(new window.Event("load"));
    await Promise.resolve();
    resolveWhenDefined?.();
    await Promise.resolve();
    await Promise.resolve();
    flushSync();

    expect(onCalls).toEqual([]);

    document.head.appendChild = originalAppendChild;
});
