// 面板在容器里的可见比例与顶部位移偏移 (单位: 面板自身高度的倍数).
export type PanelVisibility = {
  ratio: number;
  offset: number;
};

export type RectLike = { top: number; bottom: number; height: number };
export type BoxLike = { top: number; height: number };

// `Tab mode="nav"` 的滚动联动指标.
//
// 输入都是几何量, 因此可以脱离 DOM 单测:
// - `panels` 每个面板的矩形 (相对视口, 与 `getBoundingClientRect` 一致)
// - `box`    滚动容器矩形
//
// 输出:
// - `actives` 哪几项要高亮
// - `top`    指示条的顶部位移 (px)
// - `height` 指示条高度 (px)
//
// `clickIndex >= 0` 表示刚点过导航项: 此时以点击项为准 (平滑滚动还没跑完,
// 实测比例会被中间状态误导), 但 `top` 仍要夹在导航总高度内, 否则指示条会越界.
export const measurePanels = (panels: RectLike[], box: BoxLike): PanelVisibility[] =>
  panels.map((rect) => {
    if (rect.height === 0) return { ratio: 0, offset: 0 };

    const visibleTop = Math.max(rect.top - box.top, 0);
    const visibleBottom = Math.min(rect.bottom - box.top, box.height);
    const visibleHeight = Math.max(0, visibleBottom - visibleTop);

    return {
      ratio: visibleHeight / rect.height,
      offset: Math.max(0, box.top - rect.top) / rect.height,
    };
  });

export type NavMetricsOptions = {
  itemHeight: number;
  gap: number;
  // 导航项总数; 与面板数一致
  navCount: number;
  // 刚点击的项; -1 表示按滚动位置计算
  clickIndex: number;
};

export type NavMetrics = {
  actives: boolean[];
  top: number;
  height: number;
};

// 由可见比例算出指示条的位置与高度.
// 全部面板都不可见 (`ratio` 全 0) 时返回 null: 调用方保持上一次的值不动.
export const computeNavMetrics = (
  visibility: PanelVisibility[],
  { itemHeight, gap, navCount, clickIndex }: NavMetricsOptions,
): NavMetrics | null => {
  const ratios = visibility.reduce((sum, item) => sum + item.ratio, 0);
  if (ratios === 0) return null;

  const step = itemHeight + gap;
  const height = ratios * itemHeight + (Math.ceil(ratios) - 1) * gap;
  const lastBottom = navCount > 0 ? (navCount - 1) * step + itemHeight : 0;

  // 夹紧: 指示条不能伸出导航条底部
  const clampTop = (value: number): number => Math.max(0, Math.min(value, lastBottom - height));

  if (clickIndex >= 0) {
    return {
      actives: visibility.map((_, index) => index === clickIndex),
      top: clampTop(step * clickIndex),
      height,
    };
  }

  const firstIndex = visibility.findIndex((item) => item.ratio > 0);
  const first = visibility[firstIndex] ?? { ratio: 0, offset: 0 };

  return {
    actives: visibility.map((item) => item.ratio > 0),
    top: clampTop(step * firstIndex + first.offset * step),
    height,
  };
};
