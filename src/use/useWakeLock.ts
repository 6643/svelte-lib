import { writable } from "svelte/store";

export const useWakeLock = () => {
    const isSupportedWakeLock = writable(typeof navigator !== "undefined" && "wakeLock" in navigator);
    const isWakeLockActive = writable(false);
    let wakeLock: WakeLockSentinel | null = null;

    const request = async () => {
        if (typeof navigator === "undefined" || !("wakeLock" in navigator) || wakeLock) return;

        try {
            wakeLock = await navigator.wakeLock.request("screen");
            isWakeLockActive.set(true);
            wakeLock.addEventListener("release", () => {
                isWakeLockActive.set(false);
                wakeLock = null;
            });
        } catch {
            isWakeLockActive.set(false);
            wakeLock = null;
        }
    };

    const release = async () => {
        if (!wakeLock) return;
        await wakeLock.release();
    };

    const setWakeLockActive = async (active: boolean) => {
        if (active) {
            await request();
            return;
        }

        await release();
    };

    return { isSupportedWakeLock, isWakeLockActive, setWakeLockActive };
};
