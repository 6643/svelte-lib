import { expect, test } from "bun:test";

import { buildPushState, buildReplaceState, createManagedRouteState, normalizeHistoryState } from "../history.ts";
import { normalizeNavigationTarget } from "../navigation.ts";
import { decodeRouteProps } from "../query.ts";

test("normalizeNavigationTarget keeps query-only updates on the current path", () => {
    expect(normalizeNavigationTarget("?page=2", "/a?x=1#hash", "https://app.test")).toBe("/a?page=2");
});

test("decodeRouteProps decodes built-in query types", () => {
    expect(
        decodeRouteProps("?page=2&enabled=true&name=foo", {
            $page: Number,
            $enabled: Boolean,
            $name: String,
        }),
    ).toEqual({
        page: 2,
        enabled: true,
        name: "foo",
    });
});

test("buildPushState and buildReplaceState preserve managed history metadata", () => {
    const owner = "owner";
    const initial = {
        __route: createManagedRouteState(
            {
                index: 0,
                stack: ["/a"],
            },
            owner,
        ),
    };

    const pushed = buildPushState(initial, "/b", owner);
    expect(pushed.__route.stack).toEqual(["/a", "/b"]);

    const replaced = buildReplaceState(pushed, "/c", owner);
    expect(replaced.__route.stack).toEqual(["/a", "/c"]);
});

test("normalizeHistoryState replaces untrusted managed state", () => {
    const normalized = normalizeHistoryState(
        {
            foo: 1,
            __route: {
                index: 0,
                stack: ["/a"],
                signature: "bad",
            },
        },
        "/a",
        "owner",
    );

    expect((normalized as { foo?: number }).foo).toBe(1);
    expect(normalized.__route.stack).toEqual(["/a"]);
});
