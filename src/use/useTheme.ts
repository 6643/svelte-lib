import { get, writable } from "svelte/store";

type Theme = "light" | "dark";

const theme = writable<Theme>("light");
let browserThemeInitialized = false;

const resolveInitialTheme = (): Theme => {
    if (typeof window === "undefined") return "light";

    const storedTheme = window.localStorage.getItem("theme");
    if (storedTheme === "light" || storedTheme === "dark") return storedTheme;

    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

const applyTheme = (nextTheme: Theme) => {
    theme.set(nextTheme);

    if (typeof document !== "undefined") {
        document.documentElement.setAttribute("theme", nextTheme);
    }

    if (typeof window !== "undefined") {
        window.localStorage.setItem("theme", nextTheme);
    }
};

const ensureThemeInitialized = () => {
    if (typeof window === "undefined" || browserThemeInitialized) return;

    browserThemeInitialized = true;
    applyTheme(resolveInitialTheme());
};

export const useTheme = () => {
    ensureThemeInitialized();

    const setTheme = (nextTheme: Theme) => applyTheme(nextTheme);
    const toggleTheme = () => applyTheme(get(theme) === "light" ? "dark" : "light");

    return { theme, setTheme, toggleTheme };
};
