import { untrack } from "svelte";
import { cubicOut } from "svelte/easing";
import { prefersReducedMotion, Tween } from "svelte/motion";

export type TweenOptions = {
  // 补间时长 (ms), 缺省 512ms (与源实现的面板切换时长一致)
  duration?: number;
  // 缓动曲线, 缺省 cubicOut
  easing?: (t: number) => number;
};

// 把目标值补间成可读当前帧的 `Tween`.
//
// 目标值仍是调用方的 `$state`; 本工厂只负责 "目标变化 -> 从当前帧重新起补".
// 用户开启 "减少动效" 时直接跳到目标值.
//
// 改目标时先以 `duration: 0` 把上一段补间就地收尾 (`Tween` 内部会 abort 旧任务),
// 否则旧任务还会跑完自己的最后一帧, 使当前值闪到上一个目标再回头.
//
// 用法: `const x = createTween(() => target); x.current`
export const createTween = (
  target: () => number,
  { duration = 512, easing = cubicOut }: TweenOptions = {},
): Tween<number> => {
  const tween = new Tween(untrack(target), { duration, easing });

  const retarget = (next: number, ms: number): void => {
    if (ms === 0) {
      // 缩小时长的场景直接落位, 不做两次 set
      void tween.set(next, { duration: 0 });
      return;
    }

    // 第一段 set 只用来中止在飞的补间, 不改变当前值
    const current = untrack(() => tween.current);
    void tween.set(current, { duration: 0 }).then(() => tween.set(next, { duration: ms }));
  };

  $effect(() => {
    retarget(target(), prefersReducedMotion.current ? 0 : duration);

    return () => {
      // 卸载: 中止补间, 避免 RAF 任务在组件销毁后继续空跑
      void tween.set(
        untrack(() => tween.current),
        { duration: 0 },
      );
    };
  });

  return tween;
};
