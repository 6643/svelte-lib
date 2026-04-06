import { afterEach, expect, test } from "bun:test";

const loadUseFilePickerModule = async () =>
    import(new URL(`./useFilePicker.ts?test=${Date.now()}-${Math.random()}`, import.meta.url).href);

afterEach(() => {
    globalThis.document = undefined as never;
    globalThis.window = undefined as never;
});

test("useFilePicker resolves null from an explicit cancel event", async () => {
    const previousDocument = globalThis.document;
    const previousWindow = globalThis.window;
    const listeners = new Map<string, (event?: Event) => void>();

    const fakeInput = {
        accept: "",
        click: () => undefined,
        files: null as FileList | null,
        multiple: false,
        oncancel: null,
        onchange: null as ((event: Event) => void) | null,
        addEventListener: (type: string, listener: (event?: Event) => void) => {
            listeners.set(type, listener);
        },
        remove: () => undefined,
        removeEventListener: (type: string) => {
            listeners.delete(type);
        },
        type: "",
    };

    globalThis.document = {
        body: { append: () => undefined },
        createElement: () => fakeInput,
    } as never;

    globalThis.window = {
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
    } as never;

    const { useFilePicker } = await loadUseFilePickerModule();
    const pending = useFilePicker(".txt", false);

    listeners.get("cancel")?.();

    expect(await Promise.race([pending, Promise.resolve("timeout")])).toBeNull();

    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
});

test("useFilePicker does not arm the focus heuristic when cancel is supported", async () => {
    const previousDocument = globalThis.document;
    const previousWindow = globalThis.window;
    let focusListenerRegistered = false;
    const inputListeners = new Map<string, (event: Event) => void>();
    const selectedFiles = { 0: { name: "avatar.png" }, length: 1 } as unknown as FileList;

    const fakeInput = {
        accept: "",
        click: () => undefined,
        files: null as FileList | null,
        multiple: false,
        oncancel: null,
        onchange: null as ((event: Event) => void) | null,
        addEventListener: (type: string, listener: (event: Event) => void) => {
            inputListeners.set(type, listener);
        },
        remove: () => undefined,
        removeEventListener: (type: string) => {
            inputListeners.delete(type);
        },
        type: "",
    };

    globalThis.document = {
        body: { append: () => undefined },
        createElement: () => fakeInput,
    } as never;

    globalThis.window = {
        addEventListener: (type: string) => {
            if (type === "focus") {
                focusListenerRegistered = true;
            }
        },
        removeEventListener: () => undefined,
    } as never;

    const { useFilePicker } = await loadUseFilePickerModule();
    const pending = useFilePicker("image/*", true);

    expect(focusListenerRegistered).toBe(false);

    fakeInput.files = selectedFiles;
    fakeInput.onchange?.({ currentTarget: fakeInput } as never);
    inputListeners.get("change")?.({ currentTarget: fakeInput } as never);

    expect(await pending).toBe(selectedFiles);

    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
});

test("useFilePicker hides the injected input from layout and focus", async () => {
    const previousDocument = globalThis.document;
    const previousWindow = globalThis.window;
    let appendedInput: {
        ariaHidden?: string;
        style: Record<string, string>;
        tabIndex?: number;
    } | undefined;

    const fakeInput = {
        accept: "",
        ariaHidden: undefined as string | undefined,
        click: () => undefined,
        files: null as FileList | null,
        multiple: false,
        style: {} as Record<string, string>,
        addEventListener: () => undefined,
        remove: () => undefined,
        removeEventListener: () => undefined,
        setAttribute: (name: string, value: string) => {
            if (name === "aria-hidden") {
                fakeInput.ariaHidden = value;
            }
        },
        tabIndex: 0,
        type: "",
    };

    globalThis.document = {
        body: {
            append: (node: typeof fakeInput) => {
                appendedInput = node;
            },
        },
        createElement: () => fakeInput,
    } as never;

    globalThis.window = {
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
    } as never;

    const { useFilePicker } = await loadUseFilePickerModule();
    void useFilePicker(".txt", false);

    expect(appendedInput).toBe(fakeInput);
    expect(fakeInput.style.position).toBe("fixed");
    expect(fakeInput.style.opacity).toBe("0");
    expect(fakeInput.style.pointerEvents).toBe("none");
    expect(fakeInput.tabIndex).toBe(-1);
    expect(fakeInput.ariaHidden).toBe("true");

    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
});

test("useFilePicker fallback keeps a real file selection when focus returns before change", async () => {
    const previousDocument = globalThis.document;
    const previousWindow = globalThis.window;
    let focusHandler: (() => void) | undefined;
    const inputListeners = new Map<string, (event: Event) => void>();
    const selectedFiles = { 0: { name: "picked.txt" }, length: 1 } as unknown as FileList;

    const fakeInput = {
        accept: "",
        click: () => undefined,
        files: null as FileList | null,
        multiple: false,
        addEventListener: (type: string, listener: (event: Event) => void) => {
            inputListeners.set(type, listener);
        },
        remove: () => undefined,
        removeEventListener: (type: string) => {
            inputListeners.delete(type);
        },
        type: "",
    };

    globalThis.document = {
        body: { append: () => undefined },
        createElement: () => fakeInput,
    } as never;

    globalThis.window = {
        addEventListener: (type: string, listener: () => void) => {
            if (type === "focus") {
                focusHandler = listener;
            }
        },
        removeEventListener: () => undefined,
    } as never;

    const { useFilePicker } = await loadUseFilePickerModule();
    const pending = useFilePicker(".txt", false);

    focusHandler?.();
    setTimeout(() => {
        fakeInput.files = selectedFiles;
        inputListeners.get("change")?.({ currentTarget: fakeInput } as never);
    }, 10);

    expect(await pending).toBe(selectedFiles);

    globalThis.document = previousDocument;
    globalThis.window = previousWindow;
});
