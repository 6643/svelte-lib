import type { Attachment } from "svelte/attachments";
import type { LoadHandle } from "./createLoad.svelte.ts";
import { useScrollEnd } from "./useScrollEnd.ts";

// 把滚动容器接到 load 句柄上: 滚动停止后若接近视口底部就拉下一页.
// 用法: `<main {@attach useLoadMore(handle)}>`.
//
// 与源实现一致: 挂载时不会自动拉第一页, 首屏由使用方调 `handle.reset(el)` 起步.
export const useLoadMore =
  (handle: LoadHandle, threshold = 320): Attachment<HTMLElement> =>
  (el: HTMLElement): (() => void) => {
    const detach = useScrollEnd(() => {
      if (handle.wants(el, threshold)) void handle.load();
    })(el);

    return () => detach?.();
  };
