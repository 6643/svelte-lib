import { createDebounce } from "../utils/createDebounce.ts";

// 延迟 ms 后才跟随 source 的值, 期间变化被合并.
//
// 用法: `const debounced = createDebouncedSignal(() => query, 200)` 后读 `debounced.current`.
// 合并窗口的实现复用 `createDebounce`; effect 的清理函数负责取消待触发的写入,
// 因此卸载后不会再写 `$state`.
export const createDebouncedSignal = <T>(source: () => T, ms: number) => {
  // 初值取当前 source, 首帧不会闪回 undefined
  let current = $state<T>(source());

  $effect(() => {
    const latest = source();
    // 同一窗口内的连续变化被 createDebounce 合并, 只写最后一次
    const commit = createDebounce((value: T) => {
      current = value;
    }, ms);

    commit(latest);
    return commit.cancel;
  });

  return {
    get current(): T {
      return current;
    },
  };
};

export type DebouncedSignalHandle<T> = ReturnType<typeof createDebouncedSignal<T>>;
