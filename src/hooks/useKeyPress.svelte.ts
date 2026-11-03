import { on } from "svelte/events";

export type KeyPressOptions = {
  enabled?: boolean;
  capture?: boolean;
};

// 在 window 上监听指定按键.
// 在组件初始化期调用; 参数是普通值, 读 prop 即在调用点建立依赖.
export const useKeyPress = (
  keys: string | string[],
  callback: (event: KeyboardEvent) => void,
  options: KeyPressOptions = {},
): void => {
  $effect(() => {
    const active = Array.isArray(keys) ? keys : [keys];
    const { capture, enabled = true } = options;
    if (!enabled) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (active.includes(event.key)) callback(event);
    };

    return on(window, "keydown", onKeyDown, { capture });
  });
};
