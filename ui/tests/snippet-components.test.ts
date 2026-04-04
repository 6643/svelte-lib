import { afterEach, beforeEach, expect, test } from "bun:test";
import { JSDOM } from "jsdom";

import { loadCompiledComponent } from "../../route/tests/helpers/compile-svelte.ts";
import { flushSync, svelteMount, svelteUnmount } from "../../tests/helpers/svelte-client.ts";

let cleanupDom = () => {};

const installDom = () => {
    const dom = new JSDOM("<!doctype html><html><head></head><body></body></html>", {
        url: "https://app.test/",
    });

    const previous = {
        Comment: globalThis.Comment,
        CustomEvent: globalThis.CustomEvent,
        customElements: globalThis.customElements,
        document: globalThis.document,
        Element: globalThis.Element,
        Event: globalThis.Event,
        HTMLDialogElement: globalThis.HTMLDialogElement,
        HTMLMediaElement: globalThis.HTMLMediaElement,
        HTMLElement: globalThis.HTMLElement,
        Node: globalThis.Node,
        SVGElement: globalThis.SVGElement,
        Text: globalThis.Text,
        window: globalThis.window,
    };

    globalThis.window = dom.window as never;
    globalThis.Comment = dom.window.Comment as never;
    globalThis.document = dom.window.document as never;
    globalThis.Element = dom.window.Element as never;
    globalThis.Event = dom.window.Event as never;
    globalThis.HTMLDialogElement = dom.window.HTMLDialogElement as never;
    globalThis.HTMLMediaElement = dom.window.HTMLMediaElement as never;
    globalThis.HTMLElement = dom.window.HTMLElement as never;
    globalThis.Node = dom.window.Node as never;
    globalThis.SVGElement = dom.window.SVGElement as never;
    globalThis.Text = dom.window.Text as never;
    globalThis.CustomEvent = dom.window.CustomEvent as never;
    globalThis.customElements = dom.window.customElements as never;

    if (dom.window.HTMLDialogElement && !dom.window.HTMLDialogElement.prototype.showModal) {
        dom.window.HTMLDialogElement.prototype.showModal = function () {
            this.open = true;
        };
    }

    if (dom.window.HTMLDialogElement && !dom.window.HTMLDialogElement.prototype.close) {
        dom.window.HTMLDialogElement.prototype.close = function () {
            this.open = false;
        };
    }

    return () => {
        globalThis.window = previous.window;
        globalThis.Comment = previous.Comment;
        globalThis.document = previous.document;
        globalThis.Element = previous.Element;
        globalThis.Event = previous.Event;
        globalThis.HTMLDialogElement = previous.HTMLDialogElement;
        globalThis.HTMLMediaElement = previous.HTMLMediaElement;
        globalThis.HTMLElement = previous.HTMLElement;
        globalThis.Node = previous.Node;
        globalThis.SVGElement = previous.SVGElement;
        globalThis.Text = previous.Text;
        globalThis.CustomEvent = previous.CustomEvent;
        globalThis.customElements = previous.customElements;
        dom.window.close();
    };
};

beforeEach(() => {
    cleanupDom = installDom();
});

afterEach(() => {
    cleanupDom();
});

test("Block renders snippet props into the expected regions", async () => {
    const Harness = await loadCompiledComponent("./ui/tests/fixtures/BlockHarness.svelte");
    const mounted = svelteMount(Harness, { target: document.body });

    flushSync();

    expect(document.querySelector(".header [data-testid='header-actions']")?.textContent).toBe("Actions");
    expect(document.querySelector(".body [data-testid='body']")?.textContent).toBe("Body");
    expect(document.querySelector(".footer [data-testid='footer-right']")?.textContent).toBe("More");

    svelteUnmount(mounted);
});

test("StringInput and RangeInput keep snippet add-ons on the expected sides", async () => {
    const StringHarness = await loadCompiledComponent("./ui/tests/fixtures/StringInputHarness.svelte");
    const RangeHarness = await loadCompiledComponent("./ui/tests/fixtures/RangeInputHarness.svelte");
    const stringTarget = document.createElement("div");
    const rangeTarget = document.createElement("div");

    document.body.append(stringTarget, rangeTarget);

    const stringMounted = svelteMount(StringHarness, { target: stringTarget });
    const rangeMounted = svelteMount(RangeHarness, { target: rangeTarget });

    flushSync();

    const stringAddons = Array.from(stringTarget.querySelectorAll("[data-testid$='addon']")).map((node) => node.textContent);
    const rangeAddons = Array.from(rangeTarget.querySelectorAll("[data-testid$='addon']")).map((node) => node.textContent);

    expect(stringAddons).toEqual(["L", "R"]);
    expect(rangeAddons).toEqual(["Min", "Max"]);

    svelteUnmount(stringMounted);
    svelteUnmount(rangeMounted);
});

test("FilledModal and Swiper render snippet children inside their host containers", async () => {
    const ModalHarness = await loadCompiledComponent("./ui/tests/fixtures/FilledModalHarness.svelte");
    const SwiperHarness = await loadCompiledComponent("./ui/tests/fixtures/SwiperHarness.svelte");
    const modalTarget = document.createElement("div");
    const swiperTarget = document.createElement("div");

    document.body.append(modalTarget, swiperTarget);

    const modalMounted = svelteMount(ModalHarness, { target: modalTarget });
    const swiperMounted = svelteMount(SwiperHarness, { target: swiperTarget });

    flushSync();

    expect(modalTarget.querySelector("dialog [data-testid='modal-body']")?.textContent).toBe("Modal Body");
    expect(swiperTarget.querySelector("swiper-container [data-testid='slide-a']")?.textContent).toBe("A");

    svelteUnmount(modalMounted);
    svelteUnmount(swiperMounted);
});
