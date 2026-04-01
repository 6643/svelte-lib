import { expect, test } from "bun:test";
import { compile } from "svelte/compiler";

test("svelte/compiler can compile a minimal component for builder usage", () => {
    const result = compile("<script>let count = 1;</script><h1>{count}</h1>", {
        filename: "Fixture.svelte",
        generate: "client",
    });

    expect(result.js.code.includes("count")).toBe(true);
});
