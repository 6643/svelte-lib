import "./refresh.css";

export const PullState = {
  Nil: 0,
  Pulling: 1,
  Ready: 2,
  Loading: 3,
  Done: 4,
} as const;

export type PullStateValue = (typeof PullState)[keyof typeof PullState];

// 源实现的硬编码常量, 保持原值.
export const REFRESH_THRESHOLD = 80;
export const MAX_PULL_HEIGHT = 160;
export const PULL_DAMPING_FACTOR = 0.6;
export const DONE_ANIMATION_DURATION_MS = 500;
// Done 态指示器高度: 与源实现一致, 直接归零由 CSS 的过渡负责.
const HEIGHT_AT_DONE = 0;

// 下拉刷新的状态机: 只算状态与高度, 不碰 DOM.
//
// 状态迁移:
// ```mermaid
// stateDiagram-v2
//   [*] --> Nil
//   Nil --> Pulling: pointerdown (scrollTop 0 且未在 Loading/Done)
//   Pulling --> Ready: 阻尼高度 >= 阈值
//   Ready --> Pulling: 高度回落
//   Pulling --> Nil: 松手 (未达阈值) / 上滑 (raw <= 0)
//   Ready --> Loading: 松手
//   Loading --> Done: refresh resolve
//   Done --> Nil: 收起动画结束
// ```
//
// 调用方 (附件) 只负责把 `height` 与 `state` 写入 DOM.
// 每次状态/高度变化后同步回调 `onChange`, 让调用方在定时器路径上也能重画.
export const createPullRefresh = (onChange?: () => void) => {
  let state = $state<PullStateValue>(PullState.Nil);
  let height = $state(0);
  let startY = 0;
  let pointerDown = false;
  let doneTimer: ReturnType<typeof setTimeout> | undefined;

  const clearDoneTimer = () => {
    if (doneTimer === undefined) return;
    clearTimeout(doneTimer);
    doneTimer = undefined;
  };

  // 所有可见状态都在这里落定, 便于统一通知.
  const commit = (nextState: PullStateValue, nextHeight: number) => {
    if (state === nextState && height === nextHeight) return;

    state = nextState;
    height = nextHeight;
    onChange?.();
  };

  // 松开后回到初始态; 只改数据, 收起动画由调用方的 CSS 完成.
  const reset = () => {
    pointerDown = false;
    commit(PullState.Nil, 0);
  };

  const start = (clientY: number, atTop: boolean): boolean => {
    if (!atTop || state === PullState.Loading || state === PullState.Done) return false;

    startY = clientY;
    pointerDown = true;
    commit(PullState.Pulling, 0);
    return true;
  };

  const move = (clientY: number) => {
    if (!pointerDown || state === PullState.Loading || state === PullState.Done) return;

    const raw = clientY - startY;
    if (raw <= 0) {
      reset();
      return;
    }

    const next = Math.min(raw, MAX_PULL_HEIGHT) * PULL_DAMPING_FACTOR;
    commit(next >= REFRESH_THRESHOLD ? PullState.Ready : PullState.Pulling, next);
  };

  // 松手. 返回 true 表示要执行 refresh.
  // `Loading` 期间高度固定在阈值上, 指示器不会跟着手指回弹.
  const end = (): boolean => {
    if (!pointerDown) return false;

    pointerDown = false;
    if (height < REFRESH_THRESHOLD) {
      reset();
      return false;
    }

    commit(PullState.Loading, REFRESH_THRESHOLD);
    return true;
  };

  // refresh 完成: 进入 Done, 收起动画结束后回到 Nil.
  const settle = () => {
    commit(PullState.Done, HEIGHT_AT_DONE);
    clearDoneTimer();
    doneTimer = setTimeout(reset, DONE_ANIMATION_DURATION_MS);
  };

  const dispose = () => {
    clearDoneTimer();
    pointerDown = false;
  };

  return {
    get state(): PullStateValue {
      return state;
    },
    // 指示器高度, 已含阻尼
    get height(): number {
      return height;
    },
    start,
    move,
    end,
    settle,
    dispose,
  };
};

export type PullRefreshHandle = ReturnType<typeof createPullRefresh>;

// 状态 -> 宿主类名 (nil 不加类).
export const PULL_CLASS: Record<PullStateValue, string> = {
  [PullState.Nil]: "",
  [PullState.Pulling]: "pulling",
  [PullState.Ready]: "ready",
  [PullState.Loading]: "loading",
  [PullState.Done]: "done",
};
