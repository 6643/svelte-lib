// 只执行一次, 后续调用返回首次结果.
export const createOnce = <T extends (...args: never[]) => unknown>(
  fn: T,
): ((...args: Parameters<T>) => ReturnType<T>) => {
  let called = false;
  let result: ReturnType<T>;

  return (...args: Parameters<T>): ReturnType<T> => {
    if (!called) {
      called = true;
      result = fn(...args) as ReturnType<T>;
    }
    return result;
  };
};
