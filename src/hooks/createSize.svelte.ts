import { getCtor, observe, type ObserverCtor } from "./observer.ts";

export type Size = {
  width: number;
  height: number;
};

// 元素内容尺寸的响应式值.
//
// 与 `useResize` 的分工: 那一个给回调 (变化时做事), 这一个给值 (现在多大).
// 两者共用 `observe` 的挂载逻辑, 不再共用同一个 observer 实例.
//
// 用法: `<div {@attach size.attach}></div>` 后读 `size.current`.
export const createSize = (
  Ctor: ObserverCtor<ResizeObserverEntry> | undefined = getCtor("ResizeObserver"),
) => {
  let current = $state<Size>({ width: 0, height: 0 });

  const attach = observe<ResizeObserverEntry>(Ctor, (entries) => {
    // 一批里可能有多个元素, 但一个附件只观察一个元素; 取最后一条即最新
    const entry = entries[entries.length - 1];
    if (!entry) return;

    current = { width: entry.contentRect.width, height: entry.contentRect.height };
  });

  return {
    // 当前尺寸; 未挂载或首次观测前是 0
    get current(): Size {
      return current;
    },
    // 附件: 挂到目标元素上
    attach,
  };
};

export type SizeHandle = ReturnType<typeof createSize>;
