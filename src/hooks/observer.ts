import type { Attachment } from "svelte/attachments";

// 观察者的最小共同表面 (ResizeObserver / IntersectionObserver / MutationObserver 都满足).
export type ObserverLike = {
  observe: (el: Element, options?: MutationObserverInit) => void;
  disconnect: () => void;
};

export type ObserverCtor<E> = new (callback: (entries: E[]) => void) => ObserverLike;

// 观察者挂载: 每个元素一个独立 observer, 返回 `(el) => cleanup`.
//
// 源实现用模块级 observer 池 (一个 observer 观察多个元素, 回调查表分发,
// 解绑时还要把剩余目标全部重挂). 这里的池化只省下几十个对象, 却让
// "谁在观察谁" 必须靠 Map 维护; 每个元素一个 observer 后, 挂载/卸载都是 O(1).
//
// 运行时不支持该观察者 (SSR / 老环境) 时返回不挂载的附件.
//
// 返回类型故意写成窄的 `(el) => () => void`: `createSize` / `createVisibility`
// 直接把它当 `attach` 暴露, 需要确定可调用的 cleanup. 附件形态由下面的
// `observerAttachment` 提供同一实现.
export const observe = <E>(
  Ctor: ObserverCtor<E> | undefined,
  notify: (entries: E[]) => void,
): ((el: HTMLElement) => () => void) =>
  (el: HTMLElement): (() => void) => {
    if (!Ctor) return () => {};

    const observer = new Ctor(notify);
    observer.observe(el);
    return () => observer.disconnect();
  };

// 附件形态: 与 `observe` 同一实现, 只把返回类型放宽成 Svelte 的 `Attachment`.
export const observerAttachment: typeof observe = observe;

export type { Attachment };

// 从全局取构造器, 不存在时给 undefined (不抛错).
export const getCtor = <E>(
  name: "ResizeObserver" | "IntersectionObserver" | "MutationObserver",
) => {
  const value = (globalThis as Record<string, unknown>)[name];
  return typeof value === "function" ? (value as ObserverCtor<E>) : undefined;
};
