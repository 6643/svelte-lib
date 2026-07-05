import { storage, type StorageSlot } from "./useStorage.svelte.ts";

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
const defaultAccent: string = accentColors[0].value;

type ColorSlot<T> = StorageSlot<T>;

let currentThemeStorage: ColorSlot<ThemeMode> | undefined;
let currentAccentStorage: ColorSlot<string> | undefined;

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
): ColorSlot<T> => {
    const state = storage(key, initialValue);
    const storedValue = state.value();
    const normalizedStoredValue = normalize(storedValue);
    if (!Object.is(storedValue, normalizedStoredValue)) {
        state.set(normalizedStoredValue);
    }
    apply(normalizedStoredValue);
    return state;
};

const ensureThemeStorage = (): ColorSlot<ThemeMode> => {
    if (currentThemeStorage) return currentThemeStorage;
    currentThemeStorage = createColorStorage(THEME_KEY, defaultTheme, normalizeTheme, applyTheme);
    return currentThemeStorage;
};

const ensureAccentStorage = (): ColorSlot<string> => {
    if (currentAccentStorage) return currentAccentStorage;
    currentAccentStorage = createColorStorage(ACCENT_KEY, defaultAccent, (value) => value, applyAccent);
    return currentAccentStorage;
};

export const theme = (): ThemeMode => ensureThemeStorage().value();

export const setTheme = (value: ThemeMode): void => {
    const nextTheme = normalizeTheme(value);
    ensureThemeStorage().set(nextTheme);
    applyTheme(nextTheme);
};

export const accent = (): string => ensureAccentStorage().value();

export const setAccent = (value: string): void => {
    ensureAccentStorage().set(value);
    applyAccent(value);
};

export const toggleTheme = (): void => {
    setTheme(theme() === "dark" ? "light" : "dark");
};

export const __resetColorStateForTest = (): void => {
    currentThemeStorage = undefined;
    currentAccentStorage = undefined;
};
