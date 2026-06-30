import { expect, test } from "bun:test";
import { get } from "svelte/store";
import { JSDOM } from "jsdom";

import {
    __resetColorStateForTest,
    accentColors,
    accentStore,
    initAccent,
    initTheme,
    themeStore,
    useAccent,
    useTheme,
} from "./color.ts";

const installDom = (theme = "", accent = "") => {
    const dom = new JSDOM("<!doctype html><html><body></body></html>", {
        url: "https://app.test/",
    });

    dom.window.localStorage.setItem("theme", theme);
    dom.window.localStorage.setItem("accent", accent);

    const globals = globalThis as any;
    globals.window = dom.window;
    globals.document = dom.window.document;
    globals.localStorage = dom.window.localStorage;

    return () => {
        dom.window.close();
        delete globals.window;
        delete globals.document;
        delete globals.localStorage;
    };
};

test("initTheme reads storage and updates the theme attribute", () => {
    const cleanup = installDom("dark");
    __resetColorStateForTest();

    initTheme();

    expect(get(themeStore)).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");

    cleanup();
});

test("useTheme updates the store and theme attribute", () => {
    const cleanup = installDom("light");
    __resetColorStateForTest();

    initTheme();
    useTheme("dark");

    expect(get(themeStore)).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("theme")).toBe("dark");

    cleanup();
});

test("initAccent and useAccent update the CSS variable", () => {
    const cleanup = installDom("", "#ff00aa");
    __resetColorStateForTest();

    initAccent();
    expect(get(accentStore)).toBe("#ff00aa");
    expect(document.documentElement.style.getPropertyValue("--accent-color")).toBe("#ff00aa");

    useAccent(accentColors[0].value);

    expect(get(accentStore)).toBe(accentColors[0].value);
    expect(document.documentElement.style.getPropertyValue("--accent-color")).toBe(accentColors[0].value);
    expect(localStorage.getItem("accent")).toBe(accentColors[0].value);

    cleanup();
});
