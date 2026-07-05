import { expect, test } from "bun:test";
import { JSDOM } from "jsdom";

import { loadRuneModule } from "./load-rune-module.test-helper.ts";

type ThemeMode = "dark" | "light";
type ColorState<T> = {
    value: T;
    set: (value: T) => void;
};

const loadColorModule = async () =>
    loadRuneModule<{
        __resetColorStateForTest: () => void;
        accentColors: readonly { name: string; value: string }[];
        accentState: () => ColorState<string>;
        themeState: () => ColorState<ThemeMode>;
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

test("themeState reads storage and updates the theme attribute", async () => {
    const { __resetColorStateForTest, themeState } = await loadColorModule();
    const cleanup = installDom(JSON.stringify("dark"));
    __resetColorStateForTest();

    const theme = themeState();

    expect(theme.value).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("theme")).toBe(JSON.stringify("dark"));

    cleanup();
});

test("themeState updates storage and theme attribute", async () => {
    const { __resetColorStateForTest, themeState } = await loadColorModule();
    const cleanup = installDom("light");
    __resetColorStateForTest();

    const theme = themeState();
    theme.set("dark");

    expect(theme.value).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("theme")).toBe(JSON.stringify("dark"));

    cleanup();
});

test("themeState normalizes invalid stored values across state, DOM, and storage", async () => {
    const { __resetColorStateForTest, themeState } = await loadColorModule();
    const cleanup = installDom(JSON.stringify("blue"));
    __resetColorStateForTest();

    const theme = themeState();

    expect(theme.value).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem("theme")).toBe(JSON.stringify("light"));

    cleanup();
});

test("accentState reads storage and updates the CSS variable", async () => {
    const { __resetColorStateForTest, accentColors, accentState } = await loadColorModule();
    const cleanup = installDom("", JSON.stringify("#ff00aa"));
    __resetColorStateForTest();

    const accent = accentState();

    expect(accent.value).toBe("#ff00aa");
    expect(document.documentElement.style.getPropertyValue("--accent-color")).toBe("#ff00aa");
    expect(localStorage.getItem("accent")).toBe(JSON.stringify("#ff00aa"));

    accent.set(accentColors[0].value);

    expect(accent.value).toBe(accentColors[0].value);
    expect(document.documentElement.style.getPropertyValue("--accent-color")).toBe(accentColors[0].value);
    expect(localStorage.getItem("accent")).toBe(JSON.stringify(accentColors[0].value));

    cleanup();
});
