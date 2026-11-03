import { describe, expect, it, vi } from "vite-plus/test";
import {
  DONE_ANIMATION_DURATION_MS,
  MAX_PULL_HEIGHT,
  PullState,
  REFRESH_THRESHOLD,
  createPullRefresh,
} from "./createPullRefresh.svelte.ts";

describe("createPullRefresh", () => {
  it("初始是 Nil 且高度 0", () => {
    const pull = createPullRefresh();

    expect(pull.state).toBe(PullState.Nil);
    expect(pull.height).toBe(0);
  });

  it("不在顶部时 pointerdown 不进入 Pulling", () => {
    const pull = createPullRefresh();

    expect(pull.start(0, false)).toBe(false);
    expect(pull.state).toBe(PullState.Nil);
  });

  it("下拉未过阈值: Pulling -> 松手回 Nil, 不触发 refresh", () => {
    const pull = createPullRefresh();

    expect(pull.start(0, true)).toBe(true);
    expect(pull.state).toBe(PullState.Pulling);

    pull.move(100);
    // 100 * 0.6 = 60 < 80
    expect(pull.state).toBe(PullState.Pulling);
    expect(pull.height).toBeCloseTo(60);

    expect(pull.end()).toBe(false);
    expect(pull.state).toBe(PullState.Nil);
    expect(pull.height).toBe(0);
  });

  it("下拉过阈值: Ready -> 松手 Loading, 高度钉在阈值", () => {
    const pull = createPullRefresh();

    pull.start(0, true);
    pull.move(200);
    // 200 * 0.6 = 120 >= 80
    expect(pull.state).toBe(PullState.Ready);

    expect(pull.end()).toBe(true);
    expect(pull.state).toBe(PullState.Loading);
    expect(pull.height).toBe(REFRESH_THRESHOLD);
  });

  it("高度夹在 MAX_PULL_HEIGHT 的阻尼值", () => {
    const pull = createPullRefresh();

    pull.start(0, true);
    pull.move(10_000);
    expect(pull.height).toBeCloseTo(MAX_PULL_HEIGHT * 0.6);
  });

  it("上滑 (raw <= 0) 直接回 Nil", () => {
    const pull = createPullRefresh();

    pull.start(0, true);
    pull.move(-10);
    expect(pull.state).toBe(PullState.Nil);
  });

  it("Loading 期间的 move 不改变状态", () => {
    const pull = createPullRefresh();

    pull.start(0, true);
    pull.move(200);
    pull.end();
    pull.move(400);

    expect(pull.state).toBe(PullState.Loading);
    expect(pull.height).toBe(REFRESH_THRESHOLD);
  });

  it("Loading 期间再次 pointerdown 被忽略", () => {
    const pull = createPullRefresh();

    pull.start(0, true);
    pull.move(200);
    pull.end();

    expect(pull.start(0, true)).toBe(false);
    expect(pull.state).toBe(PullState.Loading);
  });

  it("settle 进入 Done, 动画结束后回到 Nil", () => {
    vi.useFakeTimers();
    const pull = createPullRefresh();

    pull.start(0, true);
    pull.move(200);
    pull.end();
    pull.settle();
    expect(pull.state).toBe(PullState.Done);

    vi.advanceTimersByTime(DONE_ANIMATION_DURATION_MS);
    expect(pull.state).toBe(PullState.Nil);
    expect(pull.height).toBe(0);

    vi.useRealTimers();
  });

  it("dispose 取消待执行的收起, 之后不再改状态", () => {
    vi.useFakeTimers();
    const pull = createPullRefresh();

    pull.start(0, true);
    pull.move(200);
    pull.end();
    pull.settle();
    pull.dispose();

    vi.advanceTimersByTime(DONE_ANIMATION_DURATION_MS);
    expect(pull.state).toBe(PullState.Done);

    vi.useRealTimers();
  });

  it("未按下时松手不触发 refresh", () => {
    const pull = createPullRefresh();

    expect(pull.end()).toBe(false);
  });
});
