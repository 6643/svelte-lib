import { expect, test } from "bun:test";

import * as devModule from "../dev";

test("builder dev no longer exports built-in proxy helpers", () => {
    expect("shouldProxyDevRequestPath" in devModule).toBe(false);
    expect("shouldProxyDevRequestMethod" in devModule).toBe(false);
    expect("createDevProxyHeaders" in devModule).toBe(false);
    expect("createDevProxyFetchInit" in devModule).toBe(false);
});
