import { expect, test } from "bun:test";

import { loadRuneModule } from "./load-rune-module.test-helper.ts";

type StorageSlot<T> = {
    value: () => T;
    set: (value: T) => void;
    update: (updater: (value: T) => T) => void;
    remove: () => void;
};
type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const loadStorage = async () => {
    const module = await loadRuneModule<{
        storage: <T>(key: string, initialValue: T, storage?: StorageLike) => StorageSlot<T>;
    }>("./useStorage.svelte.ts", import.meta.url);
    return module.storage;
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

test("storage reads the stored value", async () => {
    const storageSlot = await loadStorage();
    const storage = createStorage({ count: JSON.stringify(3) });
    const state = storageSlot("count", 0, storage);

    expect(state.value()).toBe(3);
});

test("storage does not write during initialization", async () => {
    const storageSlot = await loadStorage();
    const storage = createStorage({ count: JSON.stringify(3) });

    storageSlot("count", 0, storage);

    expect(storage.writes).toEqual([]);
});

test("storage writes updates back to storage", async () => {
    const storageSlot = await loadStorage();
    const storage = createStorage();
    const state = storageSlot("count", 0, storage);

    state.set(4);

    expect(state.value()).toBe(4);
    expect(storage.getItem("count")).toBe("4");
});

test("storage updates from the current state value", async () => {
    const storageSlot = await loadStorage();
    const storage = createStorage({ count: JSON.stringify(3) });
    const state = storageSlot("count", 0, storage);

    state.update((value) => value + 1);

    expect(state.value()).toBe(4);
    expect(storage.getItem("count")).toBe("4");
});

test("storage exposes explicit removal", async () => {
    const storageSlot = await loadStorage();
    const storage = createStorage({ count: JSON.stringify(3) });
    const state = storageSlot("count", 0, storage);

    state.remove();

    expect(storage.removes).toEqual(["count"]);
    expect(state.value()).toBe(0);
});

test("storage falls back to the initial value when stored JSON is invalid", async () => {
    const storageSlot = await loadStorage();
    const storage = createStorage({ count: "not-json" });
    const state = storageSlot("count", 0, storage);

    expect(state.value()).toBe(0);
});

test("storage works without storage methods throwing", async () => {
    const storageSlot = await loadStorage();
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

    const state = storageSlot("count", 0, storage);

    expect(state.value()).toBe(0);
    expect(() => state.set(1)).not.toThrow();
    expect(() => state.remove()).not.toThrow();
});
