import { afterEach, expect, test } from "bun:test";
import { get } from "svelte/store";

const loadUseWakeLockModule = async (): Promise<typeof import("./useWakeLock.ts")> =>
    import(new URL(`./useWakeLock.ts?test=${Date.now()}-${Math.random()}`, import.meta.url).href) as Promise<
        typeof import("./useWakeLock.ts")
    >;

const previousNavigator = globalThis.navigator;

afterEach(() => {
    globalThis.navigator = previousNavigator;
});

test("useWakeLock single-flights concurrent activation requests", async () => {
    let calls = 0;
    let releaseListener: (() => void) | undefined;
    let resolveRequest: ((value: WakeLockSentinel) => void) | undefined;
    const requestPromise = new Promise<WakeLockSentinel>((resolve) => {
        resolveRequest = resolve;
    });

    globalThis.navigator = {
        wakeLock: {
            request: async () => {
                calls += 1;
                return requestPromise;
            },
        },
    } as never;

    const { useWakeLock } = await loadUseWakeLockModule();
    const wakeLock = useWakeLock();

    const first = wakeLock.setWakeLockActive(true);
    const second = wakeLock.setWakeLockActive(true);

    expect(calls).toBe(1);

    resolveRequest?.({
        addEventListener: (_type: string, listener: () => void) => {
            releaseListener = listener;
        },
        release: async () => {
            releaseListener?.();
        },
    } as WakeLockSentinel);

    await Promise.all([first, second]);

    expect(get(wakeLock.isWakeLockActive)).toBe(true);
});
