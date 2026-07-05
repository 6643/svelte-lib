import { get } from "svelte/store";

import { useStorage, type StorageWritable } from "./useStorage.ts";

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
const defaultTheme: ThemeMode = "light";
const defaultAccent = accentColors[0].value;

type ColorStorage<T> = StorageWritable<T> & {
    stop: () => void;
};

let themeStore: ColorStorage<ThemeMode> | undefined;
let accentStore: ColorStorage<string> | undefined;

const normalizeTheme = (value: ThemeMode): ThemeMode => (value === "dark" ? "dark" : "light");

const applyTheme = (mode: ThemeMode): void => {
    document.documentElement.dataset.theme = mode;
    document.documentElement.style.setProperty("--theme-mode", mode);
};

const applyAccent = (value: string): void => {
    document.documentElement.style.setProperty("--accent-color", value);
};

const createColorStorage = <T>(
    key: string,
    initialValue: T,
    normalize: (value: T) => T,
    apply: (value: T) => void,
): ColorStorage<T> => {
    const store = useStorage(key, initialValue);
    const storedValue = get(store);
    const normalizedStoredValue = normalize(storedValue);
    if (!Object.is(storedValue, normalizedStoredValue)) {
        store.set(normalizedStoredValue);
    }
    const stop = store.subscribe((value) => apply(normalize(value)));

    return {
        subscribe: store.subscribe,
        set: (value) => store.set(normalize(value)),
        update: (updater) => store.update((value) => normalize(updater(normalize(value)))),
        remove: store.remove,
        stop,
    };
};

export const useTheme = (): ColorStorage<ThemeMode> => {
    if (themeStore) return themeStore;
    themeStore = createColorStorage(THEME_KEY, defaultTheme, normalizeTheme, applyTheme);
    return themeStore;
};

export const useAccent = (): ColorStorage<string> => {
    if (accentStore) return accentStore;
    accentStore = createColorStorage(ACCENT_KEY, defaultAccent, (value) => value, applyAccent);
    return accentStore;
};

export const toggleTheme = (): void => {
    const theme = useTheme();
    theme.set(get(theme) === "dark" ? "light" : "dark");
};

export const __resetColorStateForTest = (): void => {
    themeStore?.stop();
    accentStore?.stop();
    themeStore = undefined;
    accentStore = undefined;
};
