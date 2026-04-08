const THEME_TOKEN_NAMES = ["--theme-color", "--sf-color", "--sb-color", "--pf-color"] as const;

export type ThemeTokenName = (typeof THEME_TOKEN_NAMES)[number];
export type ThemeTokens = Record<ThemeTokenName, string>;

const LIGHT_THEME_VARS: ThemeTokens = {
    "--theme-color": "#2563eb",
    "--sf-color": "#0f172a",
    "--sb-color": "#e2e8f0",
    "--pf-color": "#475569",
};

const DARK_THEME_VARS: ThemeTokens = {
    "--theme-color": "#60a5fa",
    "--sf-color": "#e5e7eb",
    "--sb-color": "#1e293b",
    "--pf-color": "#94a3b8",
};

export const setTheme = (values: ThemeTokens): void => {
    if (typeof document === "undefined") return;

    const style = document.documentElement?.style;
    if (!style) return;

    THEME_TOKEN_NAMES.forEach((name) => {
        style.setProperty(name, values[name]);
    });
};

export const setLightTheme = (): void => {
    setTheme(LIGHT_THEME_VARS);
};

export const setDarkTheme = (): void => {
    setTheme(DARK_THEME_VARS);
};
