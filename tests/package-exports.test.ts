import { expect, test } from "bun:test";

import * as lib from "../src/_.ts";
import * as ui from "../src/ui/_.ts";
import * as route from "../src/route/_.ts";
import * as builder from "../src/builder/_.ts";
import * as runtime from "../src/builder/runtime.ts";

test("svelte-lib exports the expected public entry points", () => {
    expect("SvgIcon" in lib).toBe(true);
    expect("icon_add" in lib).toBe(true);
    expect("SvgIcon" in ui).toBe(true);
    expect("icon_add" in ui).toBe(true);
    expect("Route" in route).toBe(true);
    expect("build" in builder).toBe(true);
    expect("serve" in builder).toBe(true);
    expect("getMountTarget" in runtime).toBe(true);
    expect(runtime.mountId).toBe("app");
});
