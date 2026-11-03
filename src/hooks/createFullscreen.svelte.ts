import { on } from "svelte/events";

// 全屏开关与状态. 监听 document 的 fullscreenchange 以跟随外部变化.
// 用法: `const fs = createFullscreen()` 后读 `fs.isFullscreen`, 调 `fs.toggle()`.
export const createFullscreen = () => {
  let isFullscreen = $state(!!globalThis.document?.fullscreenElement);

  $effect(() => {
    const handler = () => {
      isFullscreen = !!document.fullscreenElement;
    };

    return on(document, "fullscreenchange", handler);
  });

  const toggle = () => {
    if (!isFullscreen) {
      void document.documentElement.requestFullscreen().catch((error: Error) => {
        console.error(
          `Error attempting to enable full-screen mode: ${error.message} (${error.name})`,
        );
      });
      return;
    }

    if (document.exitFullscreen) void document.exitFullscreen();
  };

  return {
    get isFullscreen(): boolean {
      return isFullscreen;
    },
    toggle,
  };
};

export type FullscreenHandle = ReturnType<typeof createFullscreen>;
