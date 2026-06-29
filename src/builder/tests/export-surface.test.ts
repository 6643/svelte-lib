import { expect, test } from "bun:test";

import * as builderModule from "../_";
import * as buildModule from "../build";
import * as devModule from "../dev";

test("builder aggregate export omits internal config helpers", () => {
    expect("build" in builderModule).toBe(true);
    expect("serve" in builderModule).toBe(true);
    expect("buildSvelte" in builderModule).toBe(false);
    expect("runConfiguredBuild" in builderModule).toBe(false);
    expect("runConfiguredDevServer" in builderModule).toBe(false);
    expect("validateMountId" in builderModule).toBe(false);
    expect("validateAppComponent" in builderModule).toBe(false);
    expect("resolveAppSourceRoot" in builderModule).toBe(false);
    expect("validateResolvedAppComponentPath" in builderModule).toBe(false);
});

test("build subpath export omits internal parsing and validation helpers", () => {
    expect("findUnsupportedDynamicImportExpression" in buildModule).toBe(false);
    expect("validateLocalSourceImportGraph" in buildModule).toBe(false);
    expect("createProductionEsmEnvPlugin" in buildModule).toBe(false);
    expect("resolveSvelteBrowserImportPath" in buildModule).toBe(false);
    expect("validateMountId" in buildModule).toBe(false);
});

test("dev subpath export omits internal routing and watch helpers", () => {
    expect("classifyDevWatchTarget" in devModule).toBe(false);
    expect("resolveDevRequestPath" in devModule).toBe(false);
    expect("resolveBareImportPathForDev" in devModule).toBe(false);
    expect("createDevReloadHub" in devModule).toBe(false);
});
