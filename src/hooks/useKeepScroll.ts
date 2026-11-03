import { tick } from "svelte";
import type { Attachment } from "svelte/attachments";
import { useScrollEnd } from "./useScrollEnd.ts";

// 页面级别的滚动位置缓存: page -> key -> scrollTop
const scrollPos = new Map<string, Map<string, number>>();

export const setPos = (page: string, key: string, value: number): void => {
  const pageMap = scrollPos.get(page) ?? new Map<string, number>();
  pageMap.set(key, value);
  scrollPos.set(page, pageMap);
};

export const getPos = (page: string, key: string): number => scrollPos.get(page)?.get(key) ?? 0;

export const delPos = (page: string): void => {
  scrollPos.delete(page);
};

// 记住元素滚动位置, 元素挂载后恢复一次.
// page / key 支持传 getter, 只看调用点读到的值; 切换后重新取.
//
// 恢复用 `tick()` 而不是 `setTimeout(0)`: 要等的是 "本次 DOM 更新与布局计算完成",
// `tick` 正是这个语义; 宏任务只是碰巧排在其后, 还会与用户输入/其它定时器抢顺序.
export const useKeepScroll =
  (
    page: string | (() => string),
    key: string | (() => string),
    debounceMs = 32,
  ): Attachment<HTMLElement> =>
  (el: HTMLElement): (() => void) => {
    const readPage = typeof page === "function" ? page : () => page;
    const readKey = typeof key === "function" ? key : () => key;

    const detach = useScrollEnd((top) => setPos(readPage(), readKey(), top), debounceMs)(el);

    const stored = getPos(readPage(), readKey());
    // 卸载后不再写: 元素可能已被销毁, 也可能是新附件接管了同一个位置
    let disposed = false;
    if (stored > 0) {
      void tick().then(() => {
        if (disposed) return;
        el.scrollTop = stored;
      });
    }

    return () => {
      disposed = true;
      detach?.();
    };
  };
