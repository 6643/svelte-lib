export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export type StorageState<T> = {
    value: T;
    set: (value: T) => void;
    update: (updater: (value: T) => T) => void;
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

export const useStorage = <T>(key: string, initialValue: T, storage: StorageLike = globalThis.localStorage): StorageState<T> => {
    const state = $state({
        value: readStoredValue(storage, key, initialValue),
    });

    const set = (nextValue: T) => {
        state.value = nextValue;
        writeStoredValue(storage, key, nextValue);
    };

    const update = (updater: (value: T) => T) => {
        set(updater(state.value));
    };

    const remove = () => {
        removeStoredValue(storage, key);
        state.value = initialValue;
    };

    return {
        get value() {
            return state.value;
        },
        set value(nextValue: T) {
            set(nextValue);
        },
        set,
        update,
        remove,
    };
};
