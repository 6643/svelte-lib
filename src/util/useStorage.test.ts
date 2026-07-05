import { expect, test } from "bun:test";

import { loadRuneModule } from "./load-rune-module.test-helper.ts";

type StorageState<T> = {
    value: T;
    set: (value: T) => void;
    update: (updater: (value: T) => T) => void;
    remove: () => void;
};
type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const loadUseStorage = async () => {
    const module = await loadRuneModule<{
        storageState: <T>(key: string, initialValue: T, storage?: StorageLike) => StorageState<T>;
    }>("./useStorage.svelte.ts", import.meta.url);
    return module.storageState;
};

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

test("storageState reads the stored value", async () => {
    const useStorage = await loadUseStorage();
    const storage = createStorage({ count: JSON.stringify(3) });
    const state = useStorage("count", 0, storage);

    expect(state.value).toBe(3);
});

test("storageState does not write during initialization", async () => {
    const useStorage = await loadUseStorage();
    const storage = createStorage({ count: JSON.stringify(3) });

    useStorage("count", 0, storage);

    expect(storage.writes).toEqual([]);
});

test("storageState writes updates back to storage", async () => {
    const useStorage = await loadUseStorage();
    const storage = createStorage();
    const state = useStorage("count", 0, storage);

    state.set(4);

    expect(state.value).toBe(4);
    expect(storage.getItem("count")).toBe("4");
});

test("storageState updates from the current state value", async () => {
    const useStorage = await loadUseStorage();
    const storage = createStorage({ count: JSON.stringify(3) });
    const state = useStorage("count", 0, storage);

    state.update((value) => value + 1);

    expect(state.value).toBe(4);
    expect(storage.getItem("count")).toBe("4");
});

test("storageState exposes explicit removal", async () => {
    const useStorage = await loadUseStorage();
    const storage = createStorage({ count: JSON.stringify(3) });
    const state = useStorage("count", 0, storage);

    state.remove();

    expect(storage.removes).toEqual(["count"]);
    expect(state.value).toBe(0);
});

test("storageState falls back to the initial value when stored JSON is invalid", async () => {
    const useStorage = await loadUseStorage();
    const storage = createStorage({ count: "not-json" });
    const state = useStorage("count", 0, storage);

    expect(state.value).toBe(0);
});

test("storageState works without storage methods throwing", async () => {
    const useStorage = await loadUseStorage();
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

    const state = useStorage("count", 0, storage);

    expect(state.value).toBe(0);
    expect(() => state.set(1)).not.toThrow();
    expect(() => state.remove()).not.toThrow();
});
