export type TryError = {
  fnName: string;
  args: unknown[];
  info: string;
};

// 收集异步调用的失败, 供 <TryCatch> 展示.
// tryCatch 返回包裹函数: 调用它不会抛错, 错误进 errors.
export const createTry = () => {
  let errors = $state<TryError[]>([]);

  const tryCatch =
    <T extends unknown[], R>(fn: (...args: T) => R | Promise<R>, fnName: string) =>
    async (...args: T): Promise<void> => {
      const addError = (error: unknown) => {
        const entry: TryError = {
          fnName,
          args,
          info: error instanceof Error ? error.message : String(error),
        };
        errors = [...errors, entry];
        console.error(entry);
      };

      try {
        await Promise.resolve(fn(...args));
      } catch (error) {
        addError(error);
      }
    };

  return {
    tryCatch,
    get errors() {
      return errors;
    },
    clearErrors: () => {
      errors = [];
    },
  };
};
