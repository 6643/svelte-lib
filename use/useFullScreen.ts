import { get, writable } from "svelte/store";

export const useFullScreen = () => {
    const isFullscreen = writable(typeof document !== "undefined" ? !!document.fullscreenElement : false);

    if (typeof document !== "undefined") {
        const handleChange = () => isFullscreen.set(!!document.fullscreenElement);
        document.addEventListener("fullscreenchange", handleChange);
    }

    const toggleFullScreen = async () => {
        if (typeof document === "undefined") return;

        if (!get(isFullscreen)) {
            await document.documentElement.requestFullscreen().catch(() => undefined);
            return;
        }

        await document.exitFullscreen?.().catch(() => undefined);
    };

    return { isFullscreen, toggleFullScreen };
};
