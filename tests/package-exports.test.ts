import { expect, test } from "bun:test";

import * as lib from "../_.ts";
import * as ui from "../ui/_.ts";
import * as use from "../use/_.ts";
import * as route from "../route/_.ts";
import * as builder from "../builder/_.ts";

test("svelte-lib exports the expected public entry points", () => {
    expect("Block" in lib).toBe(true);
    expect("IconButton" in lib).toBe(true);
    expect("useDebounce" in lib).toBe(true);
    expect("Swiper" in ui).toBe(true);
    expect("useTheme" in use).toBe(true);
    expect("Route" in route).toBe(true);
    expect("runConfiguredBuild" in builder).toBe(true);
});
