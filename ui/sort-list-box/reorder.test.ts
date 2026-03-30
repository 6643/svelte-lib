import { expect, test } from "bun:test";

import { reorderItems } from "./reorder.ts";

test("reorderItems moves one item to the new index", () => {
    expect(reorderItems(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
});
