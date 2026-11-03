import type { Attachment } from "svelte/attachments";
import { getCtor, observerAttachment } from "./observer.ts";

// 元素尺寸变化时回调. 用法: `<div {@attach useResize((entry) => ...)}>`.
export const useResize = (
  callback: (entry: ResizeObserverEntry) => void,
): Attachment<HTMLElement> =>
  observerAttachment<ResizeObserverEntry>(getCtor("ResizeObserver"), (entries) => {
    // 一个附件只观察一个元素, 一批里的最后一条就是最新状态
    const entry = entries[entries.length - 1];
    if (entry) callback(entry);
  });
