import { pathToFileURL } from "node:url";
import { writeFile } from "node:fs/promises";
import { serialize } from "node:v8";

const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) {
        return error.message;
    }

    return String(error);
};

const configPath = process.argv[2];
const outputPath = process.argv[3];

if (!configPath || !outputPath) {
    console.error("Missing config path or output path");
    process.exit(1);
}

try {
    const loaded = await import(pathToFileURL(configPath).href);
    const serialized = serialize(loaded.default);
    await writeFile(outputPath, serialized);
} catch (error) {
    console.error(getErrorMessage(error));
    process.exit(1);
}
