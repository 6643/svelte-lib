import { describe, expect, it } from "vite-plus/test";
import { computeNavMetrics, measurePanels } from "./navMetrics.ts";

const rect = (top: number, height: number) => ({ top, bottom: top + height, height });

describe("measurePanels", () => {
  it("完全可见的面板 ratio=1, offset=0", () => {
    const visibility = measurePanels([rect(0, 200)], { top: 0, height: 200 });

    expect(visibility).toEqual([{ ratio: 1, offset: 0 }]);
  });

  it("只露出一半时 ratio=0.5 且 offset 指认已经滚过的部分", () => {
    const visibility = measurePanels([rect(-100, 200)], { top: 0, height: 200 });

    expect(visibility[0]?.ratio).toBeCloseTo(0.5);
    expect(visibility[0]?.offset).toBeCloseTo(0.5);
  });

  it("零高面板不参与 (ratio/offset 都是 0)", () => {
    expect(measurePanels([rect(0, 0)], { top: 0, height: 200 })).toEqual([{ ratio: 0, offset: 0 }]);
  });

  it("容器外的面板 ratio=0", () => {
    expect(measurePanels([rect(400, 200)], { top: 0, height: 200 })).toEqual([
      { ratio: 0, offset: 0 },
    ]);
  });
});

describe("computeNavMetrics", () => {
  const options = { itemHeight: 48, gap: 4, navCount: 3, clickIndex: -1 };

  it("首屏一整个面板时指示条高 48, top 0", () => {
    const metrics = computeNavMetrics(
      [
        { ratio: 1, offset: 0 },
        { ratio: 0, offset: 0 },
        { ratio: 0, offset: 0 },
      ],
      options,
    );

    expect(metrics).toEqual({ actives: [true, false, false], top: 0, height: 48 });
  });

  it("两个半屏面板合计一个高度时不含间隙", () => {
    const metrics = computeNavMetrics(
      [
        { ratio: 0.5, offset: 0.5 },
        { ratio: 0.5, offset: 0 },
        { ratio: 0, offset: 0 },
      ],
      options,
    );

    // 比例合计 1.0 -> ceil(1.0)-1 = 0 个间隙
    expect(metrics?.height).toBe(48);
    // 首个可见项是索引 0, 且已滚过它的一半
    expect(metrics?.top).toBe(0.5 * 52);
    expect(metrics?.actives).toEqual([true, true, false]);
  });

  it("跨 1.5 个面板时补一个间隙", () => {
    const metrics = computeNavMetrics(
      [
        { ratio: 1, offset: 0 },
        { ratio: 0.5, offset: 0 },
        { ratio: 0, offset: 0 },
      ],
      options,
    );

    // 1.5 * 48 = 72, 再补 (ceil(1.5)-1) * 4 = 4
    expect(metrics?.height).toBe(76);
  });

  it("clickIndex >= 0 时以点击项为准", () => {
    const metrics = computeNavMetrics(
      [
        { ratio: 1, offset: 0 },
        { ratio: 0, offset: 0 },
        { ratio: 0, offset: 0 },
      ],
      { ...options, clickIndex: 1 },
    );

    expect(metrics?.actives).toEqual([false, true, false]);
    expect(metrics?.top).toBe(52);
  });

  it("指示条越界时夹在导航总高度内", () => {
    const metrics = computeNavMetrics(
      [
        { ratio: 1, offset: 0 },
        { ratio: 1, offset: 0 },
        { ratio: 1, offset: 0 },
      ],
      { ...options, clickIndex: 2 },
    );

    // 总高 3*48+2*4 = 152, 指示条自身 152, 因此 top 被夹到 0
    expect(metrics?.height).toBe(152);
    expect(metrics?.top).toBe(0);
  });

  it("全部不可见时返回 null, 调用方保留旧值", () => {
    expect(computeNavMetrics([{ ratio: 0, offset: 0 }], { ...options, navCount: 1 })).toBeNull();
  });
});
