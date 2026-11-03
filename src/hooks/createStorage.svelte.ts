// 与 Web Storage 同步的值: 初始化时读已存 JSON, 写入时回存.
// 读写失败都静默降级为纯内存, 不打断调用方.
// 用法: `const store = createStorage('k', 0)` 后 `store.value` 可直接 `bind:`.
export const createStorage = <T>(
  key: string,
  initial: T | (() => T),
  storage: Storage | undefined = globalThis.localStorage,
) => {
  const readInitial = (): T => {
    try {
      const stored = storage?.getItem(key);
      if (stored !== null && stored !== undefined) return JSON.parse(stored) as T;
    } catch {
      // 解析失败按缺省值处理
    }

    return typeof initial === "function" ? (initial as () => T)() : initial;
  };

  let value = $state<T>(readInitial());

  return {
    get value(): T {
      return value;
    },
    set value(next: T) {
      value = next;
      try {
        storage?.setItem(key, JSON.stringify(next));
      } catch {
        // 存储不可用时仅保留内存值
      }
    },
    // 函数式更新: 基于当前值算出下一个值再落盘
    update(compute: (prev: T) => T): void {
      value = compute(value);
      try {
        storage?.setItem(key, JSON.stringify(value));
      } catch {
        // 存储不可用时仅保留内存值
      }
    },
  };
};

export type StorageHandle<T> = ReturnType<typeof createStorage<T>>;
