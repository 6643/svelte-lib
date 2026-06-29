const FILE_PICKER_FALLBACK_POLL_MS = 25;
const FILE_PICKER_FALLBACK_TIMEOUT_MS = 500;

export const useFilePicker = (accept = "", multiple = false): Promise<FileList | null> =>
    new Promise((resolve) => {
        if (typeof document === "undefined" || typeof window === "undefined") {
            resolve(null);
            return;
        }

        const fileInput = Object.assign(document.createElement("input"), { type: "file", accept, multiple });
        const supportsCancelEvent = "oncancel" in fileInput;
        const style = fileInput.style as
            | {
                  height?: string;
                  inset?: string;
                  opacity?: string;
                  pointerEvents?: string;
                  position?: string;
                  width?: string;
              }
            | undefined;
        let settled = false;
        let fallbackStartedAt = 0;
        let fallbackTimer: ReturnType<typeof setTimeout> | null = null;

        const resolveSelection = () => {
            const files = fileInput.files;
            settle(files && files.length > 0 ? files : null);
        };

        const clearFallbackTimer = () => {
            if (fallbackTimer === null) return;

            clearTimeout(fallbackTimer);
            fallbackTimer = null;
        };

        const pollFallbackSelection = () => {
            if (settled) return;

            const files = fileInput.files;
            if (files && files.length > 0) {
                settle(files);
                return;
            }

            if (Date.now() - fallbackStartedAt >= FILE_PICKER_FALLBACK_TIMEOUT_MS) {
                settle(null);
                return;
            }

            fallbackTimer = setTimeout(pollFallbackSelection, FILE_PICKER_FALLBACK_POLL_MS);
        };

        const settle = (files: FileList | null) => {
            if (settled) return;
            settled = true;
            clearFallbackTimer();
            fileInput.removeEventListener("change", handleChange);
            if (supportsCancelEvent) {
                fileInput.removeEventListener("cancel", handleCancel);
            } else {
                window.removeEventListener("focus", handleFocus);
            }
            fileInput.remove();
            resolve(files);
        };

        const handleFocus = () => {
            fallbackStartedAt = Date.now();
            clearFallbackTimer();
            fallbackTimer = setTimeout(pollFallbackSelection, FILE_PICKER_FALLBACK_POLL_MS);
        };
        const handleChange = () => resolveSelection();
        const handleCancel = () => settle(null);

        fileInput.addEventListener("change", handleChange);
        if (supportsCancelEvent) {
            fileInput.addEventListener("cancel", handleCancel, { once: true });
        } else {
            window.addEventListener("focus", handleFocus, { once: true });
        }

        fileInput.tabIndex = -1;
        fileInput.setAttribute?.("aria-hidden", "true");
        if (style) {
            style.position = "fixed";
            style.opacity = "0";
            style.pointerEvents = "none";
            style.inset = "0";
            style.width = "1px";
            style.height = "1px";
        }

        document.body?.append(fileInput);
        fileInput.click();
    });
