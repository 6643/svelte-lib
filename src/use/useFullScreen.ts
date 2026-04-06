import { get, writable } from "svelte/store";

const isFullscreen = writable(false);
let fullscreenListenerBound = false;

const syncFullscreenState = () => {
    isFullscreen.set(typeof document !== "undefined" ? !!document.fullscreenElement : false);
};

const ensureFullscreenRuntime = () => {
    if (typeof document === "undefined") return;

    syncFullscreenState();
    if (fullscreenListenerBound) return;

    document.addEventListener("fullscreenchange", syncFullscreenState);
    fullscreenListenerBound = true;
};

export const useFullScreen = () => {
    ensureFullscreenRuntime();

    const toggleFullScreen = async () => {
        if (typeof document === "undefined") return;

        if (!get(isFullscreen)) {
            const requestFullscreen = document.documentElement.requestFullscreen?.bind(document.documentElement);
            if (!requestFullscreen) return;

            await requestFullscreen().catch(() => undefined);
            return;
        }

        const exitFullscreen = document.exitFullscreen?.bind(document);
        if (!exitFullscreen) return;

        await exitFullscreen().catch(() => undefined);
    };

    return { isFullscreen, toggleFullScreen };
};
