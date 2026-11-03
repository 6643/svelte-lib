import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  accent,
  getAccent,
  getResolvedThemeMode,
  getThemeMode,
  initAccent,
  initTheme,
  resetThemeForTest,
  setAccent,
  setDarkTheme,
  setLightTheme,
  setSystemTheme,
  setThemeMode,
  theme,
} from "./theme.svelte.ts";

const attr = (): string | null => document.documentElement.getAttribute("data-theme-mode");

type MediaListener = (event: { matches: boolean }) => void;

const stubMatchMedia = (matches: boolean) => {
  const listeners: MediaListener[] = [];
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches,
    media: query,
    addEventListener: (_: "change", listener: MediaListener) => listeners.push(listener),
    removeEventListener: (_: "change", listener: MediaListener) => {
      const index = listeners.indexOf(listener);
      if (index >= 0) listeners.splice(index, 1);
    },
  }));

  return {
    emit(next: boolean) {
      for (const listener of listeners.slice()) listener({ matches: next });
    },
  };
};

afterEach(() => {
  localStorage.clear();
  resetThemeForTest();
  vi.unstubAllGlobals();
  document.documentElement.removeAttribute("data-theme-mode");
  document.documentElement.style.removeProperty("--accent-color");
});

describe("主题 (单文件单例)", () => {
  it("initTheme 读已存值并写 <html data-theme-mode>", () => {
    stubMatchMedia(false);
    localStorage.setItem("svelte-lib:theme-mode", "dark");

    expect(initTheme()).toBe("dark");
    expect(attr()).toBe("dark");
    expect(theme.mode).toBe("dark");
    expect(theme.resolved).toBe("dark");
  });

  it("缺省 system: 按 matchMedia 解析, 但 mode 仍报 system", () => {
    stubMatchMedia(true);
    initTheme();

    expect(getThemeMode()).toBe("system");
    expect(getResolvedThemeMode()).toBe("dark");
    expect(attr()).toBe("dark");
  });

  it("theme.set / toggle 同步写 storage 与属性", () => {
    stubMatchMedia(false);

    expect(theme.set("dark")).toBe("dark");
    expect(localStorage.getItem("svelte-lib:theme-mode")).toBe("dark");
    expect(attr()).toBe("dark");

    expect(theme.toggle()).toBe("light");
    expect(attr()).toBe("light");
  });

  it("system 模式跟随 matchMedia change, 非 system 忽略", () => {
    const media = stubMatchMedia(false);
    setSystemTheme();
    expect(attr()).toBe("light");

    media.emit(true);
    expect(attr()).toBe("dark");
    expect(getResolvedThemeMode()).toBe("dark");

    setDarkTheme();
    media.emit(false);
    expect(attr()).toBe("dark");
  });

  it("setThemeMode / setLightTheme / setSystemTheme 都返回生效模式", () => {
    stubMatchMedia(false);

    expect(setThemeMode("system")).toBe("system");
    expect(setLightTheme()).toBe("light");
    expect(setSystemTheme()).toBe("system");
  });

  it("initTheme 幂等: 已初始化后不再重读 storage", () => {
    stubMatchMedia(false);
    initTheme();
    theme.set("dark");

    // 直接改 storage 不该被第二次 initTheme 读回来
    localStorage.setItem("svelte-lib:theme-mode", "light");
    expect(initTheme()).toBe("dark");
  });

  it("resetThemeForTest 复位模块状态, 不抹掉已写入的 storage", () => {
    stubMatchMedia(false);
    setDarkTheme();
    resetThemeForTest();

    expect(getThemeMode()).toBe("system");
    expect(getResolvedThemeMode()).toBe("light");
    expect(localStorage.getItem("svelte-lib:theme-mode")).toBe("dark");
  });
});

describe("强调色 (与主题同模块)", () => {
  it("getAccent 缺省橙色", () => {
    expect(getAccent()).toBe("#e95420");
  });

  it("initAccent 把已存色写到 --accent-color", () => {
    localStorage.setItem("svelte-lib:accent", "#9c27b0");

    expect(initAccent()).toBe("#9c27b0");
    expect(document.documentElement.style.getPropertyValue("--accent-color")).toBe("#9c27b0");
  });

  it("setAccent / accent.set 写 DOM 与 storage", () => {
    expect(setAccent("#4caf50")).toBe("#4caf50");
    expect(document.documentElement.style.getPropertyValue("--accent-color")).toBe("#4caf50");
    expect(localStorage.getItem("svelte-lib:accent")).toBe("#4caf50");

    expect(accent.set("#2196f3")).toBe("#2196f3");
    expect(accent.value).toBe("#2196f3");
  });

  it("initTheme 一并初始化强调色", () => {
    stubMatchMedia(false);
    localStorage.setItem("svelte-lib:accent", "#3f51b5");

    initTheme();
    expect(accent.value).toBe("#3f51b5");
    expect(document.documentElement.style.getPropertyValue("--accent-color")).toBe("#3f51b5");
  });
});
