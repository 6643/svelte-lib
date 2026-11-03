export type LoadMoreFn<T> = (page: number, args: T) => Promise<boolean>;

export type LoadHandle = {
  // 当前已加载到的页码
  readonly page: number;
  // 是否还有更多; false 之后不再请求
  readonly hasMore: boolean;
  // 是否有请求在飞
  readonly loading: boolean;
  // 主动拉下一页 (不满足条件时 no-op)
  load(): Promise<void>;
  // 重置到第 0 页; 传元素时若内容不足一屏会立刻拉第一页
  reset(el?: HTMLElement | null): void;
  // 内部: 供 useLoadMore 判断是否该触发
  wants(el: HTMLElement, threshold: number): boolean;
};

const getDistanceToViewportBottom = (el: HTMLElement): number =>
  el.getBoundingClientRect().top - globalThis.innerHeight;

// 触底加载的状态机. 元素绑定见 `useLoadMore`.
// more 返回 false 表示没有更多, 之后不再请求.
export const createLoad = <T>(more: LoadMoreFn<T>, getArgs: () => T): LoadHandle => {
  let page = $state(0);
  let hasMore = $state(true);
  let loading = $state(false);

  const load = async (): Promise<void> => {
    if (!hasMore || loading) return;

    loading = true;
    try {
      const next = await more(page, getArgs());
      hasMore = next;
      if (next) page = page + 1;
    } catch (error) {
      // 对外不吞错: 记录后停止继续加载, 与源实现一致
      console.error("LoadMore error:", error);
    } finally {
      loading = false;
    }
  };

  return {
    get page() {
      return page;
    },
    get hasMore() {
      return hasMore;
    },
    get loading() {
      return loading;
    },
    load,
    reset(el) {
      page = 0;
      hasMore = true;
      loading = false;

      if (el && el.scrollHeight <= el.clientHeight) void load();
    },
    wants(el, threshold) {
      if (!hasMore || loading) return false;
      return getDistanceToViewportBottom(el) <= threshold;
    },
  };
};
