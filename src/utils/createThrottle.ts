export type ThrottledFunction<T extends (...args: never[]) => unknown> = ((
  ...args: Parameters<T>
) => void) & {
  // 取消待解除的窗口, 之后可立即再次执行
  cancel: () => void;
};

// 首次立即执行, 之后每个 wait 窗口内只放行一次.
export const createThrottle = <T extends (...args: never[]) => unknown>(
  fn: T,
  wait: number,
): ThrottledFunction<T> => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const throttled = ((...args: Parameters<T>) => {
    if (timeoutId !== null) return;

    fn(...args);
    // 窗口结束时解除; 定时器句柄同时充当"窗口开着"的标志
    timeoutId = setTimeout(() => {
      timeoutId = null;
    }, wait);
  }) as ThrottledFunction<T>;

  throttled.cancel = () => {
    if (timeoutId === null) return;
    clearTimeout(timeoutId);
    timeoutId = null;
  };

  return throttled;
};
