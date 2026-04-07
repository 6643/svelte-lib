import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const distDir = resolve(import.meta.dir, "../demo/dist");

const readLargestJsChunk = () => {
    const jsFiles = readdirSync(distDir).filter((file) => file.endsWith(".js"));

    const largestFile = jsFiles
        .map((file) => ({
            file,
            size: readFileSync(resolve(distDir, file)).byteLength,
        }))
        .sort((left, right) => right.size - left.size)[0];

    if (!largestFile) {
        throw new Error("Expected demo/dist to contain at least one JS asset");
    }

    return {
        file: largestFile.file,
        source: readFileSync(resolve(distDir, largestFile.file), "utf8"),
    };
};

test("demo largest shared chunk excludes unused ui modules", () => {
    const { source } = readLargestJsChunk();

    expect(source.includes("swiper-container")).toBe(false);
    expect(source.includes("drag-handle")).toBe(false);
    expect(source.includes("<video")).toBe(false);
});
