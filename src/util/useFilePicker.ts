import { tryAsyncResult } from "./result.ts";

type OpenFilePickerOptions = {
    multiple?: boolean;
    types?: Array<{
        accept: Record<string, string[]>;
    }>;
};

const toFiles = async (handles: readonly FileSystemFileHandle[]): Promise<File[] | null> => {
    const files = await Promise.all(handles.map((handle) => handle.getFile()));
    return files.length > 0 ? files : null;
};

const toInputAccept = (types?: OpenFilePickerOptions["types"]): string =>
    types?.flatMap((type) => Object.keys(type.accept)).join(",") ?? "";

const openWithPickerFallback = (options: OpenFilePickerOptions): Promise<File[] | null> => {
    return new Promise((resolve) => {
        if (typeof document === "undefined") {
            resolve(null);
            return;
        }

        const input = document.createElement("input");
        input.type = "file";
        input.accept = toInputAccept(options.types);
        input.multiple = !!options.multiple;

        input.addEventListener(
            "change",
            () => {
                const files = input.files;
                resolve(files && files.length > 0 ? Array.from(files) : null);
            },
            { once: true },
        );

        input.click();
    });
};

const toOpenFilePickerTypes = (accept: string): OpenFilePickerOptions["types"] | undefined => {
    const types = accept
        .split(",")
        .map((token) => token.trim())
        .filter((token) => token.includes("/"));

    if (types.length === 0) return undefined;

    return [{ accept: Object.fromEntries(types.map((type) => [type, []])) }];
};

export const useFilePicker = async (accept = "", multiple = false): Promise<File[] | null> => {
    const types = toOpenFilePickerTypes(accept);
    const options = { multiple, ...(types ? { types } : {}) };
    const pickerHost = globalThis as {
        showOpenFilePicker?: (options?: OpenFilePickerOptions) => Promise<readonly FileSystemFileHandle[]>;
    };
    const picker = typeof pickerHost.showOpenFilePicker === "function" ? openWithNativePicker : openWithPickerFallback;

    return picker(options);
};

const openWithNativePicker = async (options: OpenFilePickerOptions): Promise<File[] | null> => {
    const pickerHost = globalThis as {
        showOpenFilePicker?: (options?: OpenFilePickerOptions) => Promise<readonly FileSystemFileHandle[]>;
    };
    const picked = await tryAsyncResult(async () => {
        const fileHandles = await pickerHost.showOpenFilePicker?.(options);
        return fileHandles ? toFiles(fileHandles) : null;
    });

    return picked.ok ? (picked.value ?? null) : null;
};
