let supportedWakeLock = $state(typeof navigator !== "undefined" && "wakeLock" in navigator);
let activeWakeLock = $state(false);
let wakeLock: WakeLockSentinel | null = null;
let wakeLockRequest: Promise<void> | null = null;

const syncWakeLockSupport = (): boolean => {
    supportedWakeLock = typeof navigator !== "undefined" && "wakeLock" in navigator;
    return supportedWakeLock;
};

const request = async () => {
    if (!syncWakeLockSupport() || wakeLock) return;
    if (wakeLockRequest) {
        await wakeLockRequest;
        return;
    }

    wakeLockRequest = (async () => {
        try {
            const nextWakeLock = await navigator.wakeLock.request("screen");
            wakeLock = nextWakeLock;
            activeWakeLock = true;
            nextWakeLock.addEventListener("release", () => {
                if (wakeLock !== nextWakeLock) return;
                activeWakeLock = false;
                wakeLock = null;
            });
        } catch {
            activeWakeLock = false;
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

    const currentWakeLock = wakeLock;
    await currentWakeLock.release().catch(() => undefined);
    if (wakeLock !== currentWakeLock) return;

    activeWakeLock = false;
    wakeLock = null;
};

export const isWakeLockSupported = (): boolean => syncWakeLockSupport();

export const isWakeLockActive = (): boolean => activeWakeLock;

export const setWakeLockActive = async (active: boolean): Promise<void> => {
    if (active) {
        await request();
        return;
    }

    await release();
};
