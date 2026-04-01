export const SWIPER_BUNDLE_VERSION = "12.1.3";
export const SWIPER_BUNDLE_URL = `https://cdn.jsdelivr.net/npm/swiper@${SWIPER_BUNDLE_VERSION}/swiper-element-bundle.min.js`;
export const SWIPER_BUNDLE_INTEGRITY = "sha256-4iGQDdPD/iSKX0IG2MtOlf/UOwPQGRAv0u0DO+bHYEU=";

let swiperBundlePromise: Promise<void> | null = null;

export const createSwiperBundleScript = (document: Document): HTMLScriptElement => {
    const script = document.createElement("script");
    script.src = SWIPER_BUNDLE_URL;
    script.integrity = SWIPER_BUNDLE_INTEGRITY;
    script.crossOrigin = "anonymous";
    script.dataset.swiperBundle = "true";
    return script;
};

export const ensureSwiperBundleLoaded = async (window: Window, document: Document): Promise<void> => {
    if (window.customElements.get("swiper-container")) return;
    if (swiperBundlePromise) return swiperBundlePromise;

    swiperBundlePromise = new Promise<void>((resolve, reject) => {
        const script = createSwiperBundleScript(document);
        script.onload = () => resolve();
        script.onerror = () => {
            swiperBundlePromise = null;
            reject(new Error("Failed to load Swiper bundle."));
        };
        document.head.appendChild(script);
    });

    return swiperBundlePromise;
};

export const __resetSwiperBundleLoaderForTest = (): void => {
    swiperBundlePromise = null;
};
