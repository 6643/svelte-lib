import { expect, test } from "bun:test";

import { getDragTranslateY, resolveDragIndex } from "../ui/SortListBox.drag-layout.ts";

test("resolveDragIndex clamps to the available item range", () => {
    expect(resolveDragIndex(1, 0, 40, 4)).toBe(1);
    expect(resolveDragIndex(1, 41, 40, 4)).toBe(2);
    expect(resolveDragIndex(1, 500, 40, 4)).toBe(3);
    expect(resolveDragIndex(1, -500, 40, 4)).toBe(0);
});

test("getDragTranslateY shifts only the items displaced by the drag target", () => {
    expect(getDragTranslateY(1, 3, 0, 40)).toBe(0);
    expect(getDragTranslateY(1, 3, 1, 40)).toBe(0);
    expect(getDragTranslateY(1, 3, 2, 40)).toBe(-40);
    expect(getDragTranslateY(1, 3, 3, 40)).toBe(-40);
    expect(getDragTranslateY(1, 3, 4, 40)).toBe(0);

    expect(getDragTranslateY(3, 1, 0, 40)).toBe(0);
    expect(getDragTranslateY(3, 1, 1, 40)).toBe(40);
    expect(getDragTranslateY(3, 1, 2, 40)).toBe(40);
    expect(getDragTranslateY(3, 1, 3, 40)).toBe(0);
    expect(getDragTranslateY(3, 1, 4, 40)).toBe(0);
});
