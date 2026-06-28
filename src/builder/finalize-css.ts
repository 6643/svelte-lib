import { randomUUID } from "node:crypto";
import { rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { BuildConfig } from "bun";
import { ok, fail, formatBuildLogs, getBuildErrorMessage, type Result } from "./utils";

const minifyCssContent = async (content: string): Promise<Result<string>> => {
    const tempFile = join("/tmp", `svelte-lib-css-${randomUUID()}.css`);

    try {
        await writeFile(tempFile, content, "utf8");
        const result = await Bun.build({
            entrypoints: [tempFile],
            minify: true,
            target: "browser",
            write: false,
        } as BuildConfig & { write: false });

        if (!result.success) {
            return fail(`Failed to minify CSS bundle: ${formatBuildLogs(result.logs)}`);
        }

        const asset = result.outputs.find((output) => output.path.endsWith(".css"));
        if (!asset) {
            return fail("Failed to minify CSS bundle: Bun.build emitted no CSS asset.");
        }

        return ok((await asset.text()).trimEnd());
    } catch (error) {
        return fail(`Failed to minify CSS bundle: ${getBuildErrorMessage(error)}`);
    } finally {
        await rm(tempFile, { force: true }).catch(() => undefined);
    }
};

export const finalizeMergedCssAsset = async (
    cssByPath: Map<string, string>,
    createFinalAssetFile: (content: string, extension: ".css") => string,
): Promise<Result<{ content: string; finalFile: string }>> => {
    const mergedContent = Array.from(cssByPath.values()).join("\n");
    const minified = await minifyCssContent(mergedContent);
    if (!minified.ok) {
        return minified;
    }

    return ok({
        content: minified.value,
        finalFile: createFinalAssetFile(minified.value, ".css"),
    });
};
