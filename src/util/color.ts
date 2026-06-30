import { writable, type Writable } from "svelte/store";

export type ThemeMode = "dark" | "light";

export const accentColors = [
    { name: "orange", value: "#e95420" },
    { name: "blue", value: "#2196f3" },
    { name: "purple", value: "#9c27b0" },
    { name: "pink", value: "#e91e63" },
    { name: "red", value: "#f44336" },
    { name: "green", value: "#4caf50" },
    { name: "indigo", value: "#3f51b5" },
] as const;

const THEME_KEY = "theme";
const ACCENT_KEY = "accent";

const canUseDocument = () => typeof document !== "undefined";
const canUseStorage = () => typeof globalThis.localStorage !== "undefined";

const readTheme = (): ThemeMode => {
    if (!canUseStorage()) return "light";

    try {
        const value = localStorage.getItem(THEME_KEY);
        return value === "dark" ? "dark" : "light";
    } catch {
        return "light";
    }
};

const readAccent = (): string => {
    if (!canUseStorage()) return accentColors[0].value;

    try {
        return localStorage.getItem(ACCENT_KEY) ?? accentColors[0].value;
    } catch {
        return accentColors[0].value;
    }
};

const writeTheme = (mode: ThemeMode): void => {
    if (canUseDocument()) {
        document.documentElement.dataset.theme = mode;
        document.documentElement.style.setProperty("--theme-mode", mode);
    }

    if (!canUseStorage()) return;
    try {
        localStorage.setItem(THEME_KEY, mode);
    } catch {
        // ignore storage failures
    }
};

const writeAccent = (value: string): void => {
    if (canUseDocument()) {
        document.documentElement.style.setProperty("--accent-color", value);
    }

    if (!canUseStorage()) return;
    try {
        localStorage.setItem(ACCENT_KEY, value);
    } catch {
        // ignore storage failures
    }
};

export const themeStore = writable<ThemeMode>("light");
export const accentStore = writable<string>(accentColors[0].value);

let themeInitialized = false;
let accentInitialized = false;
let themeSubscriptionBound = false;
let accentSubscriptionBound = false;

export const initTheme = (): void => {
    if (themeInitialized) return;
    themeInitialized = true;
    themeStore.set(readTheme());
    if (!themeSubscriptionBound) {
        themeStore.subscribe((mode) => writeTheme(mode));
        themeSubscriptionBound = true;
    }
};

export const initAccent = (): void => {
    if (accentInitialized) return;
    accentInitialized = true;
    accentStore.set(readAccent());
    if (!accentSubscriptionBound) {
        accentStore.subscribe((value) => writeAccent(value));
        accentSubscriptionBound = true;
    }
};

export const useTheme = (mode: ThemeMode): void => {
    initTheme();
    themeStore.set(mode);
};

export const useAccent = (value: string): void => {
    initAccent();
    accentStore.set(value);
};

export const __resetColorStateForTest = (): void => {
    themeInitialized = false;
    accentInitialized = false;
    themeSubscriptionBound = false;
    accentSubscriptionBound = false;
    themeStore.set("light");
    accentStore.set(accentColors[0].value);
};
