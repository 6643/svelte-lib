import { writable, type Writable } from "svelte/store";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const readStoredValue = <T>(storage: StorageLike, key: string, fallback: T): T => {
    try {
        const value = storage.getItem(key);
        if (value === null) return fallback;
        return JSON.parse(value) as T;
    } catch {
        return fallback;
    }
};

const writeStoredValue = <T>(storage: StorageLike, key: string, value: T): void => {
    try {
        storage.setItem(key, JSON.stringify(value));
    } catch {
        // fallback to memory only
    }
};

const removeStoredValue = (storage: StorageLike, key: string): void => {
    try {
        storage.removeItem(key);
    } catch {
        // fallback to memory only
    }
};

const createMemoryStorage = (): StorageLike => {
    const values = new Map<string, string>();

    return {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => {
            values.set(key, value);
        },
        removeItem: (key) => {
            values.delete(key);
        },
    };
};

export const useStorage = <T>(key: string, initialValue: T, storage: StorageLike = globalThis.localStorage): Writable<T> => {
    const resolvedStorage = storage ?? createMemoryStorage();
    const value = readStoredValue(resolvedStorage, key, initialValue);
    const store = writable(value);

    store.subscribe((nextValue) => {
        if (nextValue === undefined) {
            removeStoredValue(resolvedStorage, key);
            return;
        }

        writeStoredValue(resolvedStorage, key, nextValue);
    });

    return store;
};
