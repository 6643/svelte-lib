import { expect, test } from "bun:test";

import { resolveLazyRouteComponent } from "../lazy.ts";
import { validateRouteConfig } from "../validation.ts";

test("validateRouteConfig accepts a basic route definition", () => {
    const result = validateRouteConfig({
        path: "/",
        component: () => null,
        $id: Number,
    });

    expect(result.path).toBe("/");
    expect(typeof result.lazyLoader).toBe("function");
    expect(Object.keys(result.decoders)).toEqual(["$id"]);
});

test("resolveLazyRouteComponent rejects modules without a default component", () => {
    expect(() => resolveLazyRouteComponent({ default: 123 })).toThrow(
        "Lazy route component must resolve to a module with a default component export",
    );
});
