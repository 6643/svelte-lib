import { storageState, type StorageState } from "./useStorage.svelte.ts";

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

type ColorState<T> = StorageState<T>;

let currentThemeState: ColorState<ThemeMode> | undefined;
let currentAccentState: ColorState<string> | undefined;

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
): ColorState<T> => {
    const state = storageState(key, initialValue);
    const storedValue = state.value;
    const normalizedStoredValue = normalize(storedValue);
    if (!Object.is(storedValue, normalizedStoredValue)) {
        state.set(normalizedStoredValue);
    }
    apply(normalizedStoredValue);

    const set = (value: T) => {
        state.set(normalize(value));
        apply(state.value);
    };

    const update = (updater: (value: T) => T) => {
        set(updater(normalize(state.value)));
    };

    const remove = () => {
        state.remove();
        const normalized = normalize(state.value);
        if (!Object.is(state.value, normalized)) {
            state.set(normalized);
        }
        apply(state.value);
    };

    return {
        get value() {
            return state.value;
        },
        set value(value: T) {
            set(value);
        },
        set,
        update,
        remove,
    };
};

export const themeState = (): ColorState<ThemeMode> => {
    if (currentThemeState) return currentThemeState;
    const state = createColorStorage(THEME_KEY, defaultTheme, normalizeTheme, applyTheme);
    currentThemeState = state;
    return state;
};

export const accentState = (): ColorState<string> => {
    if (currentAccentState) return currentAccentState;
    const state = createColorStorage(ACCENT_KEY, defaultAccent, (value) => value, applyAccent);
    currentAccentState = state;
    return state;
};

export const toggleTheme = (): void => {
    const theme = themeState();
    theme.set(theme.value === "dark" ? "light" : "dark");
};

export const __resetColorStateForTest = (): void => {
    currentThemeState = undefined;
    currentAccentState = undefined;
};
