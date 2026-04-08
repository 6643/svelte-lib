import { expect, test } from "bun:test";

import * as lib from "../src/_.ts";
import * as ui from "../src/ui/_.ts";
import * as use from "../src/use/_.ts";
import * as route from "../src/route/_.ts";
import * as builder from "../src/builder/_.ts";

test("svelte-lib exports the expected public entry points", () => {
    expect("Block" in lib).toBe(true);
    expect("IconButton" in lib).toBe(true);
    expect("useDebounce" in lib).toBe(true);
    expect("Swiper" in ui).toBe(true);
    expect("setTheme" in ui).toBe(true);
    expect("setLightTheme" in ui).toBe(true);
    expect("setDarkTheme" in ui).toBe(true);
    expect("useTheme" in use).toBe(false);
    expect("Route" in route).toBe(true);
    expect("runConfiguredBuild" in builder).toBe(true);
});
