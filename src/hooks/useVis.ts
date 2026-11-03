import type { Attachment } from "svelte/attachments";
import { getCtor, observerAttachment } from "./observer.ts";

// 进入/离开视口时回调. 用法: `<div {@attach useVis((entry) => ...)}>`.
export const useVis = (
  callback: (entry: IntersectionObserverEntry) => void,
): Attachment<HTMLElement> =>
  observerAttachment<IntersectionObserverEntry>(getCtor("IntersectionObserver"), (entries) => {
    // 一个附件只观察一个元素, 一批里的最后一条就是最新状态
    const entry = entries[entries.length - 1];
    if (entry) callback(entry);
  });
