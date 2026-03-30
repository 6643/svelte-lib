import { describe, expect, test } from "bun:test";

import { useDebounce } from "../use/useDebounce.ts";

describe("useDebounce", () => {
    test("only invokes the last queued call", async () => {
        const values: string[] = [];
        const fn = useDebounce((value: string) => values.push(value), 10);

        fn("a");
        fn("b");

        await new Promise((resolve) => setTimeout(resolve, 25));

        expect(values).toEqual(["b"]);
    });
});
