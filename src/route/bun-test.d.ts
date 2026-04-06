declare module 'bun:test' {
  export const describe: (label: string, body: () => void) => void;
  export const test: (label: string, body: () => void | Promise<void>) => void;
  export const it: typeof test;
  export const beforeEach: (body: () => void | Promise<void>) => void;
  export const afterEach: (body: () => void | Promise<void>) => void;

  export type Matchers = {
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    toBeNull(): void;
    toBeUndefined(): void;
    toThrow(expected?: RegExp | string): void;
  };

  export const expect: (value: unknown) => Matchers;
}
