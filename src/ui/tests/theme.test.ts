import { afterEach, expect, test } from "bun:test";

const loadThemeModule = async (): Promise<typeof import("../theme.ts")> =>
    import(new URL(`../theme.ts?test=${Date.now()}-${Math.random()}`, import.meta.url).href) as Promise<
        typeof import("../theme.ts")
    >;

const previousDocument = globalThis.document;

const installThemeEnvironment = () => {
    const values = new Map<string, string>();

    globalThis.document = {
        documentElement: {
            style: {
                setProperty: (name: string, value: string) => {
                    values.set(name, value);
                },
            },
        },
    } as never;

    return values;
};

afterEach(() => {
    globalThis.document = previousDocument;
});

test("setLightTheme writes the light token set to document.documentElement.style", async () => {
    const values = installThemeEnvironment();
    const { setLightTheme } = await loadThemeModule();

    setLightTheme();

    expect(values).toEqual(
        new Map([
            ["--theme-color", "#2563eb"],
            ["--sf-color", "#0f172a"],
            ["--sb-color", "#e2e8f0"],
            ["--pf-color", "#475569"],
        ]),
    );
});

test("setDarkTheme overwrites the same variables with dark values", async () => {
    const values = installThemeEnvironment();
    const { setDarkTheme, setLightTheme } = await loadThemeModule();

    setLightTheme();
    setDarkTheme();

    expect(values).toEqual(
        new Map([
            ["--theme-color", "#60a5fa"],
            ["--sf-color", "#e5e7eb"],
            ["--sb-color", "#1e293b"],
            ["--pf-color", "#94a3b8"],
        ]),
    );
});

test("setTheme writes the provided token set to document.documentElement.style", async () => {
    const values = installThemeEnvironment();
    const { setTheme } = await loadThemeModule();

    setTheme({
        "--theme-color": "#111111",
        "--sf-color": "#222222",
        "--sb-color": "#333333",
        "--pf-color": "#444444",
    });

    expect(values).toEqual(
        new Map([
            ["--theme-color", "#111111"],
            ["--sf-color", "#222222"],
            ["--sb-color", "#333333"],
            ["--pf-color", "#444444"],
        ]),
    );
});

test("theme functions no-op outside the browser", async () => {
    globalThis.document = undefined as never;
    const { setDarkTheme, setLightTheme, setTheme } = await loadThemeModule();

    expect(() => setLightTheme()).not.toThrow();
    expect(() => setDarkTheme()).not.toThrow();
    expect(() =>
        setTheme({
            "--theme-color": "#111111",
            "--sf-color": "#222222",
            "--sb-color": "#333333",
            "--pf-color": "#444444",
        }),
    ).not.toThrow();
});
