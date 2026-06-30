export interface Ok<T> {
    readonly ok: true;
    readonly value: T;
}

export interface Err {
    readonly ok: false;
    readonly error: Error;
}

export type Result<T> = Ok<T> | Err;

type Thenable<T> = {
    then: (resolve: (value: T) => unknown, reject?: (reason: unknown) => unknown) => unknown;
};

const toError = (error: unknown): Error => {
    if (error instanceof Error) return error;
    if (hasStringMessage(error)) return new Error(error.message, { cause: error });
    if (isObjectLike(error)) return new Error(formatObjectError(error), { cause: error });
    return new Error(typeof error === "string" ? error : String(error));
};

const hasStringMessage = (value: unknown): value is { message: string } => {
    return isObjectLike(value) && "message" in value && typeof value.message === "string";
};

const isObjectLike = (value: unknown): value is Record<string, unknown> => {
    return typeof value === "object" && value !== null;
};

const formatObjectError = (value: Record<string, unknown>): string => {
    try {
        const serialized = JSON.stringify(value);
        return serialized ?? String(value);
    } catch {
        return String(value);
    }
};

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });

export const err = (error: unknown): Err => ({ ok: false, error: toError(error) });

export const isOk = <T>(result: Result<T>): result is Ok<T> => result.ok;

export const isErr = <T>(result: Result<T>): result is Err => !result.ok;

export const trySyncResult = <T>(fn: () => T): Result<T> => {
    try {
        return ok(fn());
    } catch (error) {
        return err(error);
    }
};

export const tryAsyncResult = async <T>(fn: () => T | Thenable<T>): Promise<Result<T>> => {
    try {
        return ok(await Promise.resolve(fn()));
    } catch (error) {
        return err(error);
    }
};
