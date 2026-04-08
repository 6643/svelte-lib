import { expect, test } from "bun:test";

import { createRuntimeModuleSource } from "../runtime";

test("createRuntimeModuleSource accepts a DOM id that is not a CSS identifier token", () => {
    expect(() => createRuntimeModuleSource("app:root")).not.toThrow();
});
