import { setTheme, type ThemeTokens } from "./theme.ts";

const validTheme: ThemeTokens = {
    "--theme-color": "#111111",
    "--sf-color": "#222222",
    "--sb-color": "#333333",
    "--pf-color": "#444444",
};

setTheme(validTheme);

const invalidTheme: ThemeTokens = {
    ...validTheme,
    // @ts-expect-error invalid keys must be rejected
    "--unknown-color": "#555555",
};

// keep a real usage so the invalidTheme assignment is retained by typecheck
void invalidTheme;

// @ts-expect-error partial themes must be rejected
setTheme({
    "--theme-color": "#111111",
});
