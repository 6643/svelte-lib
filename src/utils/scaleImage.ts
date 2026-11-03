let preferredMimeType: string | null = null;
const MIME_TYPE_FALLBACKS = ["image/avif", "image/webp", "image/png", "image/jpeg"];

const readFileAsDataURL = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("File read failed."));
    reader.readAsDataURL(file);
  });

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Image failed to load."));
    img.src = src;
  });

const canvasToBlob = (
  canvas: HTMLCanvasElement,
  mimeType: string,
  quality: number,
): Promise<Blob | null> => new Promise((resolve) => canvas.toBlob(resolve, mimeType, quality));

export type ScaleImageOptions = {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  mimeType?: "image/avif" | "image/webp" | "image/png" | "image/jpeg";
};

// 等比缩小图片并转成更省空间的格式, 返回新的 File.
export const scaleImage = async (file: File, options: ScaleImageOptions = {}): Promise<File> => {
  const { maxWidth = 720, maxHeight = 1080, quality = 0.8 } = options;

  const dataUrl = await readFileAsDataURL(file);
  const img = await loadImage(dataUrl);

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get canvas context.");

  let { width, height } = img;
  const ratio = width / height;

  if (width > maxWidth) {
    width = maxWidth;
    height = Math.round(width / ratio);
  }

  // 宽度收窄后高度可能仍然超限, 再收一次
  if (height > maxHeight) {
    height = maxHeight;
    width = Math.round(height * ratio);
  }

  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(img, 0, 0, width, height);

  const typesToTry = options.mimeType
    ? [options.mimeType]
    : preferredMimeType
      ? [preferredMimeType, ...MIME_TYPE_FALLBACKS.filter((type) => type !== preferredMimeType)]
      : [...MIME_TYPE_FALLBACKS];

  for (const mimeType of typesToTry) {
    const blob = await canvasToBlob(canvas, mimeType, quality);
    if (!blob) continue;

    // 记住成功的格式, 后续图片优先尝试
    preferredMimeType = mimeType;
    const extension = mimeType.split("/")[1];
    const baseName = file.name.replace(/\.[^/.]+$/, "");
    return new File([blob], `${baseName}.${extension}`, {
      type: mimeType,
      lastModified: Date.now(),
    });
  }

  throw new Error("All image conversion attempts failed.");
};
