import { expect, test } from "bun:test";
import { get } from "svelte/store";

import { useStorage } from "./useStorage.ts";

const createStorage = (seed: Record<string, string> = {}) => {
    const values = new Map(Object.entries(seed));

    return {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => {
            values.set(key, value);
        },
        removeItem: (key: string) => {
            values.delete(key);
        },
    };
};

test("useStorage reads the stored value", () => {
    const storage = createStorage({ count: JSON.stringify(3) });
    const store = useStorage("count", 0, storage);

    expect(get(store)).toBe(3);
});

test("useStorage writes updates back to storage", () => {
    const storage = createStorage();
    const store = useStorage("count", 0, storage);

    store.set(4);

    expect(storage.getItem("count")).toBe("4");
});

test("useStorage falls back to the initial value when stored JSON is invalid", () => {
    const storage = createStorage({ count: "not-json" });
    const store = useStorage("count", 0, storage);

    expect(get(store)).toBe(0);
});

test("useStorage works without storage methods throwing", () => {
    const storage = {
        getItem: () => {
            throw new Error("unavailable");
        },
        setItem: () => {
            throw new Error("unavailable");
        },
        removeItem: () => {
            throw new Error("unavailable");
        },
    };

    const store = useStorage("count", 0, storage);

    expect(get(store)).toBe(0);
    expect(() => store.set(1)).not.toThrow();
});
