import { afterEach, expect, test } from "bun:test";
import { get } from "svelte/store";

const loadUseThemeModule = async (): Promise<typeof import("./useTheme.ts")> =>
    import(new URL(`./useTheme.ts?test=${Date.now()}-${Math.random()}`, import.meta.url).href) as Promise<
        typeof import("./useTheme.ts")
    >;

const installThemeEnvironment = (storedTheme: "light" | "dark" | null = "light") => {
    const previousWindow = globalThis.window;
    const previousDocument = globalThis.document;
    const attributes = new Map<string, string>();
    let localTheme = storedTheme;

    globalThis.window = {
        localStorage: {
            getItem: () => localTheme,
            setItem: (_key: string, value: string) => {
                localTheme = value as "light" | "dark";
            },
        },
        matchMedia: () => ({ matches: false }),
    } as never;

    globalThis.document = {
        documentElement: {
            setAttribute: (name: string, value: string) => {
                attributes.set(name, value);
            },
        },
    } as never;

    return {
        attributes,
        getStoredTheme: () => localTheme,
        restore: () => {
            globalThis.window = previousWindow;
            globalThis.document = previousDocument;
        },
    };
};

afterEach(() => {
    globalThis.window = undefined as never;
    globalThis.document = undefined as never;
});

test("useTheme shares one theme store across hook instances", async () => {
    const environment = installThemeEnvironment("light");
    const { useTheme } = await loadUseThemeModule();

    const first = useTheme();
    const second = useTheme();

    first.toggleTheme();

    expect(get(first.theme)).toBe("dark");
    expect(get(second.theme)).toBe("dark");
    expect(environment.getStoredTheme()).toBe("dark");
    expect(environment.attributes.get("theme")).toBe("dark");

    environment.restore();
});
