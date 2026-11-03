import type { Attachment } from "svelte/attachments";
import { on } from "svelte/events";
import { createDebounce } from "../utils/createDebounce.ts";

// 元素滚动停止 debounceMs 后回调 scrollTop.
// 用法: `<div {@attach useScrollEnd((top) => ...)}>`.
export const useScrollEnd =
  (hook: (top: number) => void, debounceMs = 32): Attachment<HTMLElement> =>
  (el: HTMLElement): (() => void) => {
    const debounced = createDebounce((event: Event) => {
      hook((event.target as HTMLElement).scrollTop);
    }, debounceMs);

    const listener = (event: Event) => debounced(event);
    const off = on(el, "scroll", listener, { passive: true });

    return () => {
      debounced.cancel();
      off();
    };
  };
