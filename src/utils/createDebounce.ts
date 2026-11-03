export type DebouncedFunction<T extends (...args: never[]) => unknown> = ((
  ...args: Parameters<T>
) => void) & {
  cancel: () => void;
};

// 合并窗口内的连续调用, 只在窗口结束后执行最后一次.
export const createDebounce = <T extends (...args: never[]) => unknown>(
  fn: T,
  wait: number,
): DebouncedFunction<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const debounced = ((...args: Parameters<T>) => {
    if (timeoutId !== null) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      timeoutId = null;
      fn(...args);
    }, wait);
  }) as DebouncedFunction<T>;

  debounced.cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debounced;
};
