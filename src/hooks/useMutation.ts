import type { Attachment } from "svelte/attachments";
import { getCtor } from "./observer.ts";

// 过滤出真正命中目标元素 (或其子树) 的变更记录.
const selectRelevantMutations = (
  mutations: MutationRecord[],
  targetEl: Element,
): MutationRecord[] =>
  mutations.filter((record) => record.target === targetEl || targetEl.contains(record.target));

// DOM 变更时回调. 用法: `<div {@attach useMutation((records) => ..., { childList: true })}>`.
//
// 每个元素一个 observer. 源实现按 `JSON.stringify(options)` 池化,
// 解绑时要 `disconnect` 再把所有剩余目标重挂一遍; 一对一后不需要。
export const useMutation =
  (
    callback: (mutations: MutationRecord[]) => void,
    options?: MutationObserverInit,
  ): Attachment<HTMLElement> =>
  (el: HTMLElement): (() => void) => {
    const Ctor = getCtor<MutationRecord>("MutationObserver");
    if (!Ctor) return () => {};

    const observer = new Ctor((mutations) => {
      const relevant = selectRelevantMutations(mutations, el);
      if (relevant.length > 0) callback(relevant);
    });
    observer.observe(el, options);

    return () => observer.disconnect();
  };
