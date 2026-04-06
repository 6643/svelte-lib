import { afterEach, expect, test } from "bun:test";

const loadUseImgScaleModule = async () =>
    import(new URL(`./useImgScale.ts?test=${Date.now()}-${Math.random()}`, import.meta.url).href);

afterEach(() => {
    globalThis.document = undefined as never;
    globalThis.FileReader = undefined as never;
    globalThis.Image = undefined as never;
});

test("useImgScale throws a clear browser-environment error when browser APIs are unavailable", async () => {
    const previousDocument = globalThis.document;
    const previousFileReader = globalThis.FileReader;
    const previousImage = globalThis.Image;
    globalThis.document = undefined as never;
    globalThis.FileReader = undefined as never;
    globalThis.Image = undefined as never;

    const { useImgScale } = await loadUseImgScaleModule();
    let error: unknown = null;

    try {
        await useImgScale(new File(["a"], "avatar.png", { type: "image/png" }));
    } catch (caught) {
        error = caught;
    }

    expect(error instanceof Error).toBe(true);
    expect((error as Error).message).toBe("useImgScale requires a browser environment");

    globalThis.document = previousDocument;
    globalThis.FileReader = previousFileReader;
    globalThis.Image = previousImage;
});
