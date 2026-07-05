import { writable, type Updater, type Writable } from "svelte/store";

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type StorageWritable<T> = Writable<T> & {
    remove: () => void;
};

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
        // keep the in-memory store value even when browser storage is unavailable
    }
};

const removeStoredValue = (storage: StorageLike, key: string): void => {
    try {
        storage.removeItem(key);
    } catch {
        // keep the in-memory store value even when browser storage is unavailable
    }
};

export const useStorage = <T>(key: string, initialValue: T, storage: StorageLike = globalThis.localStorage): StorageWritable<T> => {
    const value = readStoredValue(storage, key, initialValue);
    const store = writable(value);

    const set = (nextValue: T) => {
        store.set(nextValue);
        writeStoredValue(storage, key, nextValue);
    };

    const update = (updater: Updater<T>) => {
        store.update((currentValue) => {
            const nextValue = updater(currentValue);
            writeStoredValue(storage, key, nextValue);
            return nextValue;
        });
    };

    const remove = () => {
        removeStoredValue(storage, key);
        store.set(initialValue);
    };

    return {
        subscribe: store.subscribe,
        set,
        update,
        remove,
    };
};
