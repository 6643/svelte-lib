import { expect, test } from "bun:test";
import { JSDOM } from "jsdom";
import { get } from "svelte/store";

import { __resetColorStateForTest, accentColors, useAccent, useTheme } from "./color.ts";

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

test("useTheme reads storage and updates the theme attribute", () => {
    const cleanup = installDom(JSON.stringify("dark"));
    __resetColorStateForTest();

    const theme = useTheme();

    expect(get(theme)).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("theme")).toBe(JSON.stringify("dark"));

    cleanup();
});

test("theme store updates storage and theme attribute", () => {
    const cleanup = installDom("light");
    __resetColorStateForTest();

    const theme = useTheme();
    theme.set("dark");

    expect(get(theme)).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("theme")).toBe(JSON.stringify("dark"));

    cleanup();
});

test("useTheme normalizes invalid stored values across store, DOM, and storage", () => {
    const cleanup = installDom(JSON.stringify("blue"));
    __resetColorStateForTest();

    const theme = useTheme();

    expect(get(theme)).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem("theme")).toBe(JSON.stringify("light"));

    cleanup();
});

test("accent store reads storage and updates the CSS variable", () => {
    const cleanup = installDom("", JSON.stringify("#ff00aa"));
    __resetColorStateForTest();

    const accent = useAccent();

    expect(get(accent)).toBe("#ff00aa");
    expect(document.documentElement.style.getPropertyValue("--accent-color")).toBe("#ff00aa");
    expect(localStorage.getItem("accent")).toBe(JSON.stringify("#ff00aa"));

    accent.set(accentColors[0].value);

    expect(get(accent)).toBe(accentColors[0].value);
    expect(document.documentElement.style.getPropertyValue("--accent-color")).toBe(accentColors[0].value);
    expect(localStorage.getItem("accent")).toBe(JSON.stringify(accentColors[0].value));

    cleanup();
});
