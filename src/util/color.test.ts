import { expect, test } from "bun:test";
import { JSDOM } from "jsdom";

import { loadRuneModule } from "./load-rune-module.test-helper.ts";

type ThemeMode = "dark" | "light";

const loadColorModule = async () =>
    loadRuneModule<{
        __resetColorStateForTest: () => void;
        accentColors: readonly { name: string; value: string }[];
        accent: () => string;
        setAccent: (value: string) => void;
        setTheme: (mode: ThemeMode) => void;
        theme: () => ThemeMode;
    }>("./color.svelte.ts", import.meta.url);

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

test("theme reads storage and updates the theme attribute", async () => {
    const { __resetColorStateForTest, theme } = await loadColorModule();
    const cleanup = installDom(JSON.stringify("dark"));
    __resetColorStateForTest();

    expect(theme()).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("theme")).toBe(JSON.stringify("dark"));

    cleanup();
});

test("setTheme updates storage and theme attribute", async () => {
    const { __resetColorStateForTest, setTheme, theme } = await loadColorModule();
    const cleanup = installDom("light");
    __resetColorStateForTest();

    setTheme("dark");

    expect(theme()).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("theme")).toBe(JSON.stringify("dark"));

    cleanup();
});

test("theme normalizes invalid stored values across state, DOM, and storage", async () => {
    const { __resetColorStateForTest, theme } = await loadColorModule();
    const cleanup = installDom(JSON.stringify("blue"));
    __resetColorStateForTest();

    expect(theme()).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem("theme")).toBe(JSON.stringify("light"));

    cleanup();
});

test("accent reads storage and setAccent updates the CSS variable", async () => {
    const { __resetColorStateForTest, accent, accentColors, setAccent } = await loadColorModule();
    const cleanup = installDom("", JSON.stringify("#ff00aa"));
    __resetColorStateForTest();

    expect(accent()).toBe("#ff00aa");
    expect(document.documentElement.style.getPropertyValue("--accent-color")).toBe("#ff00aa");
    expect(localStorage.getItem("accent")).toBe(JSON.stringify("#ff00aa"));

    setAccent(accentColors[0].value);

    expect(accent()).toBe(accentColors[0].value);
    expect(document.documentElement.style.getPropertyValue("--accent-color")).toBe(accentColors[0].value);
    expect(localStorage.getItem("accent")).toBe(JSON.stringify(accentColors[0].value));

    cleanup();
});
