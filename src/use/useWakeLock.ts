import { writable } from "svelte/store";

export const useWakeLock = () => {
    const isSupportedWakeLock = writable(typeof navigator !== "undefined" && "wakeLock" in navigator);
    const isWakeLockActive = writable(false);
    let wakeLock: WakeLockSentinel | null = null;
    let wakeLockRequest: Promise<void> | null = null;

    const request = async () => {
        if (typeof navigator === "undefined" || !("wakeLock" in navigator) || wakeLock) return;
        if (wakeLockRequest) {
            await wakeLockRequest;
            return;
        }

        wakeLockRequest = (async () => {
            try {
                const nextWakeLock = await navigator.wakeLock.request("screen");
                wakeLock = nextWakeLock;
                isWakeLockActive.set(true);
                nextWakeLock.addEventListener("release", () => {
                    if (wakeLock !== nextWakeLock) return;
                    isWakeLockActive.set(false);
                    wakeLock = null;
                });
            } catch {
                isWakeLockActive.set(false);
                wakeLock = null;
            } finally {
                wakeLockRequest = null;
            }
        })();

        await wakeLockRequest;
    };

    const release = async () => {
        if (wakeLockRequest) {
            await wakeLockRequest;
        }
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
