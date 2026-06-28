import { isAbsolute, join, relative } from "node:path";

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });

export const fail = (error: string): Result<never> => ({ ok: false, error });

export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
};

export const getErrorCode = (error: unknown): string | undefined =>
  error instanceof Error && "code" in error && typeof error.code === "string"
    ? error.code
    : undefined;

export const isPathWithinRoot = (rootPath: string, candidatePath: string): boolean => {
  const relativePath = relative(rootPath, candidatePath);
  return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
};

export const normalizeModulePath = (value: string): string => value.replace(/\\/g, "/");

export const resolveConfiguredPath = (rootDir: string, value: string | undefined, fallback: string): string => {
  const target = value ?? fallback;
  return isAbsolute(target) ? target : join(rootDir, target);
};
