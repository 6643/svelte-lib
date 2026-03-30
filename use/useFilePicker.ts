export const useFilePicker = (accept = "", multiple = false): Promise<FileList | null> =>
    new Promise((resolve) => {
        if (typeof document === "undefined" || typeof window === "undefined") {
            resolve(null);
            return;
        }

        const fileInput = Object.assign(document.createElement("input"), { type: "file", accept, multiple });
        let settled = false;

        const settle = (files: FileList | null) => {
            if (settled) return;
            settled = true;
            window.removeEventListener("focus", handleFocus);
            resolve(files);
        };

        const handleFocus = () => setTimeout(() => settle(null), 300);

        fileInput.onchange = (event: Event) => {
            const target = event.currentTarget as HTMLInputElement;
            settle(target.files && target.files.length > 0 ? target.files : null);
        };

        window.addEventListener("focus", handleFocus, { once: true });
        fileInput.click();
    });
