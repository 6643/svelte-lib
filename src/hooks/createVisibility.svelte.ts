import { getCtor, observe, type ObserverCtor } from "./observer.ts";

// 元素是否在视口内的响应式值.
//
// 与 `useVis` 的分工: 那一个给回调 (进出视口时做事), 这一个给值 (现在可见吗).
// 两者共用 `observe` 的挂载逻辑, 不再共用同一个 observer 实例.
//
// 用法: `<div {@attach visibility.attach}></div>` 后读 `visibility.visible`.
export const createVisibility = (
  Ctor: ObserverCtor<IntersectionObserverEntry> | undefined = getCtor("IntersectionObserver"),
) => {
  let visible = $state(false);

  const attach = observe<IntersectionObserverEntry>(Ctor, (entries) => {
    const entry = entries[entries.length - 1];
    if (!entry) return;

    visible = entry.isIntersecting;
  });

  return {
    // 是否与视口相交
    get visible(): boolean {
      return visible;
    },
    // 附件: 挂到目标元素上
    attach,
  };
};

export type VisibilityHandle = ReturnType<typeof createVisibility>;
