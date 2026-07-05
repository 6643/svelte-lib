import { expect, test } from "bun:test";
import { get } from "svelte/store";

import { useStorage } from "./useStorage.ts";

const createStorage = (seed: Record<string, string> = {}) => {
    const values = new Map(Object.entries(seed));
    const writes: [key: string, value: string][] = [];
    const removes: string[] = [];

    return {
        writes,
        removes,
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => {
            writes.push([key, value]);
            values.set(key, value);
        },
        removeItem: (key: string) => {
            removes.push(key);
            values.delete(key);
        },
    };
};

test("useStorage reads the stored value", () => {
    const storage = createStorage({ count: JSON.stringify(3) });
    const store = useStorage("count", 0, storage);

    expect(get(store)).toBe(3);
});

test("useStorage does not write during initialization", () => {
    const storage = createStorage({ count: JSON.stringify(3) });

    useStorage("count", 0, storage);

    expect(storage.writes).toEqual([]);
});

test("useStorage writes updates back to storage", () => {
    const storage = createStorage();
    const store = useStorage("count", 0, storage);

    store.set(4);

    expect(storage.getItem("count")).toBe("4");
});

test("useStorage updates from the current store value", () => {
    const storage = createStorage({ count: JSON.stringify(3) });
    const store = useStorage("count", 0, storage);

    store.update((value) => value + 1);

    expect(get(store)).toBe(4);
    expect(storage.getItem("count")).toBe("4");
});

test("useStorage exposes explicit removal", () => {
    const storage = createStorage({ count: JSON.stringify(3) });
    const store = useStorage("count", 0, storage);

    store.remove();

    expect(storage.removes).toEqual(["count"]);
    expect(get(store)).toBe(0);
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
    expect(() => store.remove()).not.toThrow();
});
