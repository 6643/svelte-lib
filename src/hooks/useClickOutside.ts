import type { Attachment } from "svelte/attachments";
import { on } from "svelte/events";

export type ClickOutsideOptions = { enabled?: () => boolean };

// 点击元素之外时回调 handler.
// 用法: `<div {@attach useClickOutside(() => close())}>`.
// options.enabled 读到的状态变化会重挂附件 (返回 false 时不监听).
export const useClickOutside =
  (handler: () => void, options: ClickOutsideOptions = {}): Attachment<Element> =>
  (el: Element): (() => void) | void => {
    if (!(options.enabled?.() ?? true)) return;

    const onClick = (event: MouseEvent) => {
      if (!el.contains(event.target as Node)) handler();
    };

    return on(document.body, "mousedown", onClick);
  };
