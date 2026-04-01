import { randomUUID } from "node:crypto";
import { rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const ok = <T>(value: T): Result<T> => ({ ok: true, value });
const fail = (error: string): Result<never> => ({ ok: false, error });

const formatBuildLogs = (logs: Array<{ message?: string; name?: string }>): string => {
    if (logs.length === 0) {
        return "Bun.build failed without diagnostic logs.";
    }

    return logs.map((log) => log.message ?? log.name ?? "Unknown build error").join("\n");
};

const getBuildErrorMessage = (error: unknown): string => {
    if (typeof error === "object" && error !== null && "logs" in error && Array.isArray(error.logs)) {
        return formatBuildLogs(error.logs as Array<{ message?: string; name?: string }>);
    }

    return error instanceof Error ? error.message : String(error);
};

const minifyCssContent = async (content: string): Promise<Result<string>> => {
    const tempFile = join("/tmp", `svelte-lib-css-${randomUUID()}.css`);

    try {
        await writeFile(tempFile, content, "utf8");
        const result = await Bun.build({
            entrypoints: [tempFile],
            minify: true,
            target: "browser",
            write: false,
        } as Bun.BuildConfig & { write: false });

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
