let preferredMimeType: string | null = null;
const MIME_TYPE_FALLBACKS = ["image/avif", "image/webp", "image/png", "image/jpeg"] as const;

const readFileAsDataURL = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("File read failed."));
        reader.readAsDataURL(file);
    });

const loadImage = (src: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("Image failed to load."));
        image.src = src;
    });

const canvasToBlob = (canvas: HTMLCanvasElement, mimeType: string, quality: number): Promise<Blob | null> =>
    new Promise((resolve) => canvas.toBlob(resolve, mimeType, quality));

type ImgScaleOptions = {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number;
    mimeType?: "image/avif" | "image/webp" | "image/png" | "image/jpeg";
};

export const useImgScale = async (file: File, options: ImgScaleOptions = {}): Promise<File> => {
    const { maxWidth = 720, maxHeight = 1080, quality = 0.8 } = options;
    const dataUrl = await readFileAsDataURL(file);
    const image = await loadImage(dataUrl);
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
        throw new Error("Failed to get canvas context.");
    }

    let { width, height } = image;
    const ratio = width / height;

    if (width > maxWidth) {
        width = maxWidth;
        height = Math.round(width / ratio);
    }

    if (height > maxHeight) {
        height = maxHeight;
        width = Math.round(height * ratio);
    }

    canvas.width = width;
    canvas.height = height;
    context.drawImage(image, 0, 0, width, height);

    const typesToTry = options.mimeType
        ? [options.mimeType]
        : preferredMimeType
            ? [preferredMimeType, ...MIME_TYPE_FALLBACKS.filter((type) => type !== preferredMimeType)]
            : [...MIME_TYPE_FALLBACKS];

    for (const mimeType of typesToTry) {
        const blob = await canvasToBlob(canvas, mimeType, quality);

        if (!blob) continue;

        preferredMimeType = mimeType;

        const extension = mimeType.split("/")[1];
        const originalNameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
        const nextName = `${originalNameWithoutExt}.${extension}`;

        return new File([blob], nextName, { type: mimeType, lastModified: Date.now() });
    }

    throw new Error("All image conversion attempts failed.");
};
