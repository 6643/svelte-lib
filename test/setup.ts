import { afterEach } from "vite-plus/test";
import { clearMotionQueue } from "./motionQueue.ts";

// 全局用例收尾: 清空 svelte/motion 的模块级 RAF 任务队列.
//
// 队列是模块级的: 上一个用例在真实时钟下残留的帧任务会让下一个用例 (切到假表后)
// 排不到驱动帧, 补间就永远停在起点. 这里只清队列, 不动时钟 (各用例自己管).
afterEach(() => {
  clearMotionQueue();
});
