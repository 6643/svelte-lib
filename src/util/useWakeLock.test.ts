import { expect, test } from "bun:test";

import { loadRuneModule } from "./load-rune-module.test-helper.ts";

test("wake lock helpers expose support, active state, and setter", async () => {
    const { isWakeLockActive, isWakeLockSupported, setWakeLockActive } = await loadRuneModule<{
        isWakeLockActive: () => boolean;
        isWakeLockSupported: () => boolean;
        setWakeLockActive: (active: boolean) => Promise<void>;
    }>("./useWakeLock.svelte.ts", import.meta.url);

    expect(isWakeLockSupported()).toBe("wakeLock" in navigator);
    expect(isWakeLockActive()).toBe(false);
    expect(typeof setWakeLockActive).toBe("function");
});
