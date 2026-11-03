// 主题与强调色的唯一真源.
//
// 合并了原先的 `themeMode.ts` / `themeAccent.ts` / `themeStore.svelte.ts`:
// 三个文件各自持有一份模块级状态 + 一份 storage 读写, 改一处要同步三处.
// 现在模块级 `$state` 只在这里写, storage 只在 init 读一次、在 set 时落盘.
//
// 状态形状:
// - `mode`     用户意图 (`light` / `dark` / `system`), 与 storage 一一对应
// - `resolved` 实际生效的主题; `system` 模式下跟随 `prefers-color-scheme`
// - `accent`   强调色字符串, 写到 `<html style="--accent-color">`
//
// 本模块顶层零副作用: 浏览器对象都在函数里惰性取.
export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

// 存储键带命名空间, 避免与 solid 版同时存在时互相覆盖.
const MODE_KEY = "svelte-lib:theme-mode";
const ACCENT_KEY = "svelte-lib:accent";

const THEME_ATTRIBUTE = "data-theme-mode";
const ACCENT_PROPERTY = "--accent-color";
const DEFAULT_ACCENT = "#e95420";
const MEDIA_QUERY = "(prefers-color-scheme: dark)";

// 单例句柄形状; 组件只读 `.mode` / `.resolved`, 与 rune 读属性即订阅.
export type ThemeHandle = {
  readonly mode: ThemeMode;
  readonly resolved: ResolvedTheme;
  set(next: ThemeMode): ThemeMode;
  toggle(): ThemeMode;
};

// ── 状态 ──

let mode = $state<ThemeMode>("system");
let resolved = $state<ResolvedTheme>("light");
// 空串表示"本次会话还没设过", 读的时候回落到 storage / 缺省色
let accentValue = $state<string>("");
let initialized = false;

// `system` 模式下 persist 的 media listener 摘除句柄.
let stopSystemSync: (() => void) | undefined;

// ── storage ──

const readStorage = (key: string): string | undefined => {
  try {
    return globalThis.localStorage?.getItem(key) ?? undefined;
  } catch {
    // 隐私模式下 localStorage 会抛错, 视为没有已存值
    return undefined;
  }
};

const writeStorage = (key: string, value: string): void => {
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    // 写失败不影响本次会话
  }
};

const isThemeMode = (value: string | undefined): value is ThemeMode =>
  value === "light" || value === "dark" || value === "system";

// ── DOM ──

const applyResolved = (next: ResolvedTheme): void => {
  resolved = next;
  globalThis.document?.documentElement?.setAttribute(THEME_ATTRIBUTE, next);
};

const applyAccent = (color: string): void => {
  globalThis.document?.documentElement?.style?.setProperty(ACCENT_PROPERTY, color);
};

const resolveSystem = (): ResolvedTheme => {
  try {
    return globalThis.matchMedia?.(MEDIA_QUERY).matches ? "dark" : "light";
  } catch {
    return "light";
  }
};

const stopListeningSystem = (): void => {
  stopSystemSync?.();
  stopSystemSync = undefined;
};

// `system` 模式才订阅; 其它模式先摘监听再落值, 保证不会有两份监听同时生效.
const startListeningSystem = (): void => {
  stopListeningSystem();

  const query = globalThis.matchMedia?.(MEDIA_QUERY);
  if (!query) return;

  const listener = (event: MediaQueryListEvent) => {
    if (mode !== "system") return;
    applyResolved(event.matches ? "dark" : "light");
  };

  query.addEventListener("change", listener);
  stopSystemSync = () => query.removeEventListener("change", listener);
};

// ── 写入 ──

const applyMode = (next: ThemeMode): ThemeMode => {
  mode = next;
  writeStorage(MODE_KEY, next);

  if (next === "system") {
    applyResolved(resolveSystem());
    startListeningSystem();
    return next;
  }

  stopListeningSystem();
  applyResolved(next);
  return next;
};

const applyAccentValue = (next: string): string => {
  accentValue = next;
  writeStorage(ACCENT_KEY, next);
  applyAccent(next);
  return next;
};

// ── 公开 API ──

// 读已存主题并应用; 幂等, 第二次调用不再读 storage.
export const initTheme = (): ThemeMode => {
  if (initialized) return mode;

  const stored = readStorage(MODE_KEY);
  const applied = applyMode(isThemeMode(stored) ? stored : "system");
  accentValue = readStorage(ACCENT_KEY) ?? DEFAULT_ACCENT;
  applyAccent(accentValue);
  initialized = true;
  return applied;
};

export const getThemeMode = (): ThemeMode => mode;

export const getResolvedThemeMode = (): ResolvedTheme => resolved;

export const setThemeMode = (next: ThemeMode): ThemeMode => applyMode(next);

export const setSystemTheme = (): ThemeMode => applyMode("system");

export const setLightTheme = (): ThemeMode => applyMode("light");

export const setDarkTheme = (): ThemeMode => applyMode("dark");

// 读强调色 (不写 DOM): 本次会话值 > storage > 缺省橙.
export const getAccent = (): string => accentValue || readStorage(ACCENT_KEY) || DEFAULT_ACCENT;

// 读出已存强调色并应用到 DOM.
export const initAccent = (): string => applyAccentValue(getAccent());

export const setAccent = (value: string): string => applyAccentValue(value);

// 全局主题单例: 读属性即订阅.
export const theme: ThemeHandle = {
  get mode(): ThemeMode {
    return mode;
  },
  get resolved(): ResolvedTheme {
    return resolved;
  },
  set: setThemeMode,
  toggle(): ThemeMode {
    return applyMode(resolved === "dark" ? "light" : "dark");
  },
};

// 全局强调色单例.
export const accent = {
  get value(): string {
    return accentValue || getAccent();
  },
  set: setAccent,
};

// 测试用: 复位模块状态 (不抹掉已写入的 storage).
export const resetThemeForTest = (): void => {
  stopListeningSystem();
  initialized = false;
  mode = "system";
  resolved = "light";
  accentValue = "";
};
