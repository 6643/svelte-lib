/** Resolve a static element or accessor to the current element value. */
export const readEl = <T>(ref: T | (() => T | undefined | null)): T | undefined | null =>
    typeof ref === "function" ? (ref as () => T | undefined | null)() : ref;
