import { expect, test } from "bun:test";
import { JSDOM } from "jsdom";

import { useFilePicker } from "./useFilePicker.ts";

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

test("useFilePicker uses showOpenFilePicker when available", async () => {
    const files = [new File(["alpha"], "alpha.txt", { type: "text/plain" })];

    const originalWindow = globalThis.window;
    const originalShowOpenFilePicker = (globalThis as any).showOpenFilePicker;
    const picker = async () => [
        {
            getFile: async () => files[0],
        },
    ];

    globalThis.window = {
        showOpenFilePicker: picker,
    } as any;
    (globalThis as any).showOpenFilePicker = picker;

    try {
        const picked = await useFilePicker("text/plain", true);

        expect(picked).not.toBeNull();
        expect(picked?.map((file) => file.name)).toEqual(["alpha.txt"]);
    } finally {
        globalThis.window = originalWindow;
        (globalThis as any).showOpenFilePicker = originalShowOpenFilePicker;
    }
});

test("useFilePicker preserves every native picker handle when multiple is enabled", async () => {
    const files = [
        new File(["alpha"], "alpha.txt", { type: "text/plain" }),
        new File(["beta"], "beta.txt", { type: "text/plain" }),
    ];

    const originalWindow = globalThis.window;
    const originalShowOpenFilePicker = (globalThis as any).showOpenFilePicker;
    const picker = async () => files.map((file) => ({ getFile: async () => file }));

    globalThis.window = {
        showOpenFilePicker: picker,
    } as any;
    (globalThis as any).showOpenFilePicker = picker;

    try {
        const picked = await useFilePicker("text/plain", true);

        expect(picked?.map((file) => file.name)).toEqual(["alpha.txt", "beta.txt"]);
    } finally {
        globalThis.window = originalWindow;
        (globalThis as any).showOpenFilePicker = originalShowOpenFilePicker;
    }
});

test("useFilePicker falls back to input selection when native picker is unavailable", async () => {
    const cleanup = installDom();
    const files = [new File(["beta"], "beta.txt", { type: "text/plain" })];

    const originalCreateElement = document.createElement.bind(document);
    document.createElement = ((tagName: string) => {
        const element = originalCreateElement(tagName);

        if (tagName.toLowerCase() === "input") {
            Object.defineProperty(element, "files", {
                configurable: true,
                get: () => files,
            });

            element.click = () => {
                element.dispatchEvent(new document.defaultView!.Event("change"));
            };
        }

        return element;
    }) as typeof document.createElement;

    try {
        const picked = await useFilePicker("text/plain", true);

        expect(picked).not.toBeNull();
        expect(picked?.map((file) => file.name)).toEqual(["beta.txt"]);
    } finally {
        document.createElement = originalCreateElement;
        cleanup();
    }
});

test("useFilePicker uses input selection when native picker is unavailable", async () => {
    const cleanup = installDom();
    const files = [new File(["gamma"], "gamma.txt", { type: "text/plain" })];

    const originalCreateElement = document.createElement.bind(document);
    document.createElement = ((tagName: string) => {
        const element = originalCreateElement(tagName);

        if (tagName.toLowerCase() === "input") {
            Object.defineProperty(element, "files", {
                configurable: true,
                get: () => files,
            });

            element.click = () => {
                element.dispatchEvent(new document.defaultView!.Event("change"));
            };
        }

        return element;
    }) as typeof document.createElement;

    try {
        const picked = await useFilePicker("text/plain", false);

        expect(picked).not.toBeNull();
        expect(picked?.map((file) => file.name)).toEqual(["gamma.txt"]);
    } finally {
        document.createElement = originalCreateElement;
        cleanup();
    }
});
