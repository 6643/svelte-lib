let currentFullscreen = $state(false);
let fullscreenListenerBound = false;

const syncFullscreenState = () => {
    currentFullscreen = typeof document !== "undefined" ? !!document.fullscreenElement : false;
};

const ensureFullscreenRuntime = () => {
    if (typeof document === "undefined") return;

    syncFullscreenState();
    if (fullscreenListenerBound) return;

    document.addEventListener("fullscreenchange", syncFullscreenState);
    fullscreenListenerBound = true;
};

export const isFullscreen = (): boolean => {
    ensureFullscreenRuntime();
    return currentFullscreen;
};

export const setFullscreen = async (enabled: boolean): Promise<void> => {
    if (typeof document === "undefined") return;

    ensureFullscreenRuntime();
    if (enabled) {
        if (currentFullscreen) return;

        const requestFullscreen = document.documentElement.requestFullscreen?.bind(document.documentElement);
        if (!requestFullscreen) return;

        await requestFullscreen().catch(() => undefined);
        syncFullscreenState();
        return;
    }

    if (!currentFullscreen) return;

    const exitFullscreen = document.exitFullscreen?.bind(document);
    if (!exitFullscreen) return;

    await exitFullscreen().catch(() => undefined);
    syncFullscreenState();
};

export const toggleFullscreen = async (): Promise<void> => setFullscreen(!isFullscreen());
