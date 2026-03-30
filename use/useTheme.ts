import { get, writable } from "svelte/store";

type Theme = "light" | "dark";

const resolveInitialTheme = (): Theme => {
    if (typeof window === "undefined") return "light";

    const storedTheme = window.localStorage.getItem("theme");
    if (storedTheme === "light" || storedTheme === "dark") return storedTheme;

    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
};

export const useTheme = () => {
    const theme = writable<Theme>(resolveInitialTheme());

    const applyTheme = (nextTheme: Theme) => {
        theme.set(nextTheme);

        if (typeof document !== "undefined") {
            document.documentElement.setAttribute("theme", nextTheme);
        }

        if (typeof window !== "undefined") {
            window.localStorage.setItem("theme", nextTheme);
        }
    };

    applyTheme(get(theme));

    const setTheme = (nextTheme: Theme) => applyTheme(nextTheme);
    const toggleTheme = () => applyTheme(get(theme) === "light" ? "dark" : "light");

    return { theme, setTheme, toggleTheme };
};
