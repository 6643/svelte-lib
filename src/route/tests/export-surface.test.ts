import { expect, test } from "bun:test";

import * as route from "../_.ts";

test("route package keeps internal runtime helpers out of the public surface", () => {
    expect("Route" in route).toBe(true);
    expect("routePush" in route).toBe(true);
    expect("routeReplace" in route).toBe(true);
    expect("routeCurrentPath" in route).toBe(true);
    expect("routeBackPath" in route).toBe(true);
    expect("initRuntime" in route).toBe(false);
    expect("registerRoute" in route).toBe(false);
    expect("subscribeRuntime" in route).toBe(false);
});
