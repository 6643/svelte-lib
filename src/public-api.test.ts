import { describe, expect, it } from "vite-plus/test";
import * as lib from "./index.ts";

// 与 solid-lib/src/_.ts 的公开符号对齐 (回归护栏, 不是驱动测试).
// 差异项在 index.ts 注释里显式记录: createTry 拆成 createTry + TryCatch 组件.
const EXPECTED = [
  // icons
  "SvgIcon",
  // buttons
  "Button",
  // inputs (合并源实现的 10 个导出)
  "Input",
  // layout
  "Block",
  "FlexBox",
  "GridBox",
  "StackBox",
  "CenterBox",
  // interaction
  "Modal",
  "Expand",
  "Carousel",
  "Tab",
  // display
  "AvatarImage",
  "CountDown",
  "Counter",
  "TimeLine",
  "ImagePlayer",
  "ListBox",
  "SortListBox",
  // functional
  "CityPicker",
  "initCities",
  "LoadMore",
  "ThemeSwitch",
  "AccentSelector",
  "ThemeToggle",
  "AccentPicker",
  // theme
  "initTheme",
  "theme",
  "initAccent",
  "accent",
  "getThemeMode",
  "getResolvedThemeMode",
  "setThemeMode",
  "setSystemTheme",
  "setLightTheme",
  "setDarkTheme",
  "getAccent",
  "setAccent",
  // hooks & utils
  "createMediaQuery",
  "createTween",
  "createDebounce",
  "createDebouncedSignal",
  "createCopy",
  "createFullscreen",
  "createStorage",
  "createThrottle",
  "createOnce",
  "getChinaTimestamp",
  "createTry",
  "TryCatch",
  "useClickOutside",
  "pickFile",
  "useTap",
  "useLongPress",
  "createHttp",
  "http",
  "scaleImage",
  "useKeepScroll",
  "getPos",
  "setPos",
  "delPos",
  "useKeyPress",
  "createLoad",
  "useLoadMore",
  "useMutation",
  "useRefresh",
  "createPullRefresh",
  "createSize",
  "createVisibility",
  "createCountdown",
  "PULL_CLASS",
  "useResize",
  "useScrollEnd",
  "useVis",
  "createWakeLock",
] as const;

describe("public api", () => {
  it.each(EXPECTED)("%s 已导出且非空", (name) => {
    const value = (lib as Record<string, unknown>)[name];
    expect(value).toBeDefined();
    expect(["function", "object"]).toContain(typeof value);
  });

  it("图标导出可直接取用", () => {
    const iconKeys = Object.keys(lib).filter((key) => key.startsWith("icon_"));

    expect(iconKeys.length).toBeGreaterThan(100);
    expect(iconKeys.every((key) => typeof (lib as Record<string, unknown>)[key] === "string")).toBe(
      true,
    );
  });

  it("导出数量不少于 solid 侧 (允许新增)", () => {
    expect(Object.keys(lib).length).toBeGreaterThanOrEqual(EXPECTED.length);
  });
});
