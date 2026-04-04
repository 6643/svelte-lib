import { afterEach, beforeEach, expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { loadCompiledComponent } from "./route.helper.compile-svelte.ts";
import { flushSync, svelteMount, svelteUnmount } from "./helpers.svelte-client.ts";

let cleanupDom = () => {};

const installDom = () => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>", {
        url: "https://app.test/",
    });

    const previous = {
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

    return () => {
        globalThis.window = previous.window;
        globalThis.document = previous.document;
        globalThis.Element = previous.Element;
        globalThis.Event = previous.Event;
        globalThis.HTMLElement = previous.HTMLElement;
        globalThis.Node = previous.Node;
        globalThis.Text = previous.Text;
        globalThis.SVGElement = previous.SVGElement;
        dom.window.close();
    };
};

beforeEach(() => {
    cleanupDom = installDom();
});

afterEach(() => {
    cleanupDom();
});

test("SortListBox removes drag listeners when unmounted mid-drag", async () => {
    const SortListBoxHarness = await loadCompiledComponent("./tests/ui.fixture.SortListBoxHarness.svelte");
    const target = document.createElement("div");
    document.body.append(target);

    const activeListeners = new Map<string, Set<EventListenerOrEventListenerObject>>();
    const originalAddEventListener = document.addEventListener.bind(document);
    const originalRemoveEventListener = document.removeEventListener.bind(document);

    document.addEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) => {
        const listeners = activeListeners.get(type) ?? new Set<EventListenerOrEventListenerObject>();
        listeners.add(listener);
        activeListeners.set(type, listeners);
        originalAddEventListener(type, listener, options);
    }) as typeof document.addEventListener;

    document.removeEventListener = ((type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions) => {
        activeListeners.get(type)?.delete(listener);
        originalRemoveEventListener(type, listener, options);
    }) as typeof document.removeEventListener;

    const mounted = svelteMount(SortListBoxHarness, { target });
    flushSync();

    const dragHandle = target.querySelector(".drag-handle");
    if (!(dragHandle instanceof Element)) {
        throw new Error("Missing drag handle");
    }

    const pointerDown = new window.Event("pointerdown", { bubbles: true, cancelable: true });
    Object.defineProperties(pointerDown, {
        button: { value: 0 },
        clientY: { value: 10 },
        isPrimary: { value: true },
    });

    dragHandle.dispatchEvent(pointerDown);
    expect(activeListeners.get("pointermove")?.size ?? 0).toBe(1);
    expect(activeListeners.get("pointerup")?.size ?? 0).toBe(1);

    svelteUnmount(mounted);
    flushSync();

    expect(activeListeners.get("pointermove")?.size ?? 0).toBe(0);
    expect(activeListeners.get("pointerup")?.size ?? 0).toBe(0);

    document.addEventListener = originalAddEventListener;
    document.removeEventListener = originalRemoveEventListener;
});
