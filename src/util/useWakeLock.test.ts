import { expect, test } from "bun:test";

import { loadRuneModule } from "./load-rune-module.test-helper.ts";

test("wakeLockState exposes support and active flags as rune state", async () => {
    const { wakeLockState } = await loadRuneModule<{
        wakeLockState: () => {
            isSupportedWakeLock: { value: boolean };
            isWakeLockActive: { value: boolean };
            setWakeLockActive: (active: boolean) => Promise<void>;
        };
    }>("./useWakeLock.svelte.ts", import.meta.url);

    const wakeLock = wakeLockState();

    expect(wakeLock.isSupportedWakeLock.value).toBe("wakeLock" in navigator);
    expect(wakeLock.isWakeLockActive.value).toBe(false);
    expect(typeof wakeLock.setWakeLockActive).toBe("function");
});
