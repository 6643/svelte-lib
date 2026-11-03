import { getPos, setPos } from "./hooks/useKeepScroll.ts";

// 当前路径: 滚动位置按路径隔离, 不同页面互不干扰.
export const currentPath = (): string => globalThis.location?.pathname ?? "/";

// 读取某个 tab 组上次停留的索引.
export const readTabIndex = (key: string): number => getPos(currentPath(), key);

// 记住某个 tab 组当前索引.
export const writeTabIndex = (key: string, index: number): void => {
  setPos(currentPath(), key, index);
};

// 内容面板的滚动位置 key: 每个 tab 项各自独立.
export const panelScrollKey = (key: string, index: number): string => `${key}.${index}`;
