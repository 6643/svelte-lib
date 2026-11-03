import type { Attachment } from "svelte/attachments";
import { PULL_CLASS, PullState, createPullRefresh } from "./createPullRefresh.svelte.ts";

// 下拉刷新: 顶部下拉超过阈值后回调 refresh, 完成后播放收起动画.
//
// 用法: `<div {@attach useRefresh(refresh)}>`; 状态机在 `createPullRefresh`,
// 附件只把指针事件喂给它, 再把 `state` / `height` 写进 DOM.
export const useRefresh =
  (refresh: () => Promise<void>): Attachment<HTMLElement> =>
  (el: HTMLElement): (() => void) => {
    el.classList.add("use-refresh-host");

    // 状态机每次落定都会调 onChange, 定时器路径 (Done -> Nil) 也能重画
    const pull = createPullRefresh(() => {
      el.style.setProperty("--pull-height", String(pull.height));
      for (const [value, name] of Object.entries(PULL_CLASS)) {
        if (!name) continue;
        el.classList.toggle(name, Number(value) === pull.state);
      }
    });

    const onPointerStart = (event: PointerEvent) => {
      if (!pull.start(event.clientY, el.scrollTop === 0)) return;

      el.setPointerCapture?.(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      pull.move(event.clientY);
      // 只在下拉时才阻止默认滚动, 否则会吃掉正常滚动
      if (pull.state === PullState.Pulling || pull.state === PullState.Ready) {
        event.preventDefault();
      }
    };

    const onPointerEnd = (event: PointerEvent) => {
      const shouldRefresh = pull.end();
      if (el.hasPointerCapture?.(event.pointerId)) el.releasePointerCapture(event.pointerId);
      if (!shouldRefresh) return;

      void refresh().finally(() => pull.settle());
    };

    // 保留 addEventListener 而非 svelte/events 的 on(): 源码 events.js 会把
    // pointer* 事件延后一个微任务才真正挂载 (规避 Chrome cloneNode bug), 而下拉依赖同步挂载
    el.addEventListener("pointerdown", onPointerStart);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerEnd);
    el.addEventListener("pointercancel", onPointerEnd);

    return () => {
      pull.dispose();
      el.removeEventListener("pointerdown", onPointerStart);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerEnd);
      el.removeEventListener("pointercancel", onPointerEnd);
      el.classList.remove("use-refresh-host", "pulling", "ready", "loading", "done");
      el.style.removeProperty("--pull-height");
    };
  };
