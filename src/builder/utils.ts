import { isAbsolute, join, relative } from "node:path";

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });

export const err = (error: string): Result<never> => ({ ok: false, error });

export const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) {
        return error.message;
    }
    return String(error);
};

export const getErrorCode = (error: unknown): string | undefined =>
    error instanceof Error && "code" in error && typeof error.code === "string" ? error.code : undefined;

export const isPathWithinRoot = (rootPath: string, candidatePath: string): boolean => {
    const relativePath = relative(rootPath, candidatePath);
    return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
};

export const isPathWithinAnyRoot = (roots: string[], candidatePath: string): boolean =>
    roots.some((rootPath) => isPathWithinRoot(rootPath, candidatePath));

export const formatBuildLogs = (logs: Array<{ message?: string; name?: string }>): string => {
    if (logs.length === 0) {
        return "Bun.build failed without diagnostic logs.";
    }
    return logs.map((log) => log.message ?? log.name ?? "Unknown build error").join("\n");
};

export const getBuildErrorMessage = (error: unknown): string => {
    if (typeof error === "object" && error !== null && "logs" in error && Array.isArray(error.logs)) {
        return formatBuildLogs(error.logs as Array<{ message?: string; name?: string }>);
    }
    return error instanceof Error ? error.message : String(error);
};

export const normalizeModulePath = (value: string): string => value.replace(/\\/g, "/");

export const resolveConfiguredPath = (rootDir: string, value: string | undefined, fallback: string): string => {
    const target = value ?? fallback;
    return isAbsolute(target) ? target : join(rootDir, target);
};
