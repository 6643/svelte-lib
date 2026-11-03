import { raf } from "svelte/internal/client";

// 清空 svelte/motion 的全局 RAF 任务队列.
//
// 队列是模块级的: 切到假表时如果还留着真实时钟下排的帧任务, 新补间会因为
// `raf.tasks.size !== 0` 而不再排驱动帧, 于是在假表里永远不推进.
// 用例收尾时调用 (cleanup 之后), 保证每个用例从空队列开始.
export const clearMotionQueue = (): void => {
  raf.tasks.clear();
};
