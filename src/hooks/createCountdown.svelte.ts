// 倒数计时器: 每秒减一, 到 0 时恰好触发一次 `onDone`.
//
// 定时器由本工厂的 `$effect` 起停: 挂载后开始走, 卸载时自动停.
// 调用方不需要写 `$effect(() => countdown.start())`, 因此只能在组件初始化期调用.
//
// 不变量: 剩余秒数减到 0 的那一拍就结算并停表, 因此 `onDone` 不可能触发两次.
export const createCountdown = (options: {
  initial: number;
  onDone?: () => void;
  interval?: number;
}) => {
  const interval = options.interval ?? 1000;
  let remaining = $state(options.initial);

  // 结算: 停表并回调一次. 由 effect 的清理负责停表, 这里只切标志.
  let settled = false;

  const settle = () => {
    if (settled) return;
    settled = true;
    options.onDone?.();
  };

  const run = () => {
    if (remaining <= 0) {
      settle();
      return;
    }

    remaining -= 1;
    // 减到 0 的这一拍立即结算, 不用再等一秒
    if (remaining === 0) settle();
  };

  // 只读 interval 常量, 不读 remaining, 因此不会因自身写入而重建
  $effect(() => {
    const timer = setInterval(run, interval);
    return () => clearInterval(timer);
  });

  return {
    get remaining(): number {
      return remaining;
    },
    // 手动推进一拍 (单测与外力驱动用)
    tick: run,
  };
};

export type CountdownHandle = ReturnType<typeof createCountdown>;
