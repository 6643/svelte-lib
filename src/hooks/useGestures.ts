import type { Attachment } from "svelte/attachments";

export type GestureOptions = {
  // tap: 按下到抬起的最大时长 (ms)
  threshold?: number;
  // longPress: 触发前需要按住的时长 (ms)
  delay?: number;
  // 允许的最大位移 (px)
  moveThreshold?: number;
  stopPropagation?: boolean;
  capturePointer?: boolean;
};

type Handlers = {
  onPointerDown?: (event: PointerEvent, pointerId: number) => void;
  onPointerMove?: (event: PointerEvent, pointerId: number) => void;
  onPointerUp?: (event: PointerEvent, pointerId: number) => void;
  onPointerCancel?: (event: PointerEvent, pointerId: number) => void;
};

// 指针事件绑定: 只跟踪首个按下的指针, 并负责 setPointerCapture/release.
// useTap / useLongPress 共用这一层.
const pointerEvents =
  (readHandlers: () => Handlers, readCapture: () => boolean) =>
  (el: HTMLElement): (() => void) => {
    let activePointerId: number | null = null;

    const handleDown = (event: PointerEvent) => {
      if (event.button !== 0) return;

      activePointerId = event.pointerId;
      if (readCapture()) {
        const target = event.currentTarget;
        if (target instanceof Element) target.setPointerCapture(activePointerId);
      }
      readHandlers().onPointerDown?.(event, activePointerId);
    };

    const handleMove = (event: PointerEvent) => {
      if (activePointerId === null || event.pointerId !== activePointerId) return;
      readHandlers().onPointerMove?.(event, activePointerId);
    };

    const release = (event: PointerEvent) => {
      if (readCapture() && (event.currentTarget as Element).hasPointerCapture?.(activePointerId!)) {
        (event.currentTarget as Element).releasePointerCapture(activePointerId!);
      }
      activePointerId = null;
    };

    const handleUp = (event: PointerEvent) => {
      if (activePointerId === null || event.pointerId !== activePointerId) return;

      readHandlers().onPointerUp?.(event, activePointerId);
      release(event);
    };

    const handleCancel = (event: PointerEvent) => {
      if (activePointerId === null || event.pointerId !== activePointerId) return;

      readHandlers().onPointerCancel?.(event, activePointerId);
      release(event);
    };

    // 保留 addEventListener 而非 svelte/events 的 on(): 源码 events.js 会把
    // pointer* / touch* / wheel 延后一个微任务才真正挂载 (规避 Chrome cloneNode bug),
    // 而手势依赖同步挂载
    el.addEventListener("pointerdown", handleDown);
    el.addEventListener("pointermove", handleMove);
    el.addEventListener("pointerup", handleUp);
    el.addEventListener("pointercancel", handleCancel);
    el.addEventListener("pointerleave", handleCancel);

    return () => {
      el.removeEventListener("pointerdown", handleDown);
      el.removeEventListener("pointermove", handleMove);
      el.removeEventListener("pointerup", handleUp);
      el.removeEventListener("pointercancel", handleCancel);
      el.removeEventListener("pointerleave", handleCancel);
    };
  };

// 轻点: 按下到抬起 < threshold 且位移 < moveThreshold 才算. 用法: `{@attach useTap(fn)}`.
export const useTap =
  (onTap: (event: PointerEvent) => void, options: GestureOptions = {}): Attachment<HTMLElement> =>
  (el: HTMLElement): (() => void) => {
    let startTimestamp: number | null = null;
    let startX: number | null = null;
    let startY: number | null = null;

    const threshold = options.threshold ?? 300;
    const moveThreshold = options.moveThreshold ?? 10;
    const stopPropagation = options.stopPropagation ?? false;

    return pointerEvents(
      () => ({
        onPointerDown: (event) => {
          startTimestamp = event.timeStamp;
          startX = event.clientX;
          startY = event.clientY;
        },
        onPointerUp: (event) => {
          if (
            startTimestamp !== null &&
            startX !== null &&
            startY !== null &&
            event.timeStamp - startTimestamp < threshold
          ) {
            const deltaX = event.clientX - startX;
            const deltaY = event.clientY - startY;

            if (Math.sqrt(deltaX * deltaX + deltaY * deltaY) < moveThreshold) {
              if (stopPropagation) event.stopPropagation();
              onTap(event);
            }
          }

          startTimestamp = null;
          startX = null;
          startY = null;
        },
        onPointerCancel: () => {
          startTimestamp = null;
          startX = null;
          startY = null;
        },
      }),
      () => options.capturePointer ?? true,
    )(el);
  };

// 长按: 按住超过 delay 且位移不超过 moveThreshold 才触发. 用法: `{@attach useLongPress(fn)}`.
export const useLongPress =
  (
    onLongPress: (event: PointerEvent) => void,
    options: GestureOptions = {},
  ): Attachment<HTMLElement> =>
  (el: HTMLElement): (() => void) => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let startX: number | null = null;
    let startY: number | null = null;

    const delay = options.delay ?? 500;
    const moveThreshold = options.moveThreshold ?? 10;

    const clearTimer = () => {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const detach = pointerEvents(
      () => ({
        onPointerDown: (event) => {
          startX = event.clientX;
          startY = event.clientY;
          clearTimer();
          timer = setTimeout(() => {
            onLongPress(event);
            timer = null;
          }, delay);
        },
        onPointerMove: (event) => {
          if (startX === null || startY === null) return;

          const deltaX = event.clientX - startX;
          const deltaY = event.clientY - startY;
          if (Math.sqrt(deltaX * deltaX + deltaY * deltaY) > moveThreshold) clearTimer();
        },
        onPointerUp: () => {
          clearTimer();
          startX = null;
          startY = null;
        },
        onPointerCancel: () => {
          clearTimer();
          startX = null;
          startY = null;
        },
      }),
      () => options.capturePointer ?? true,
    )(el);

    return () => {
      clearTimer();
      detach();
    };
  };
