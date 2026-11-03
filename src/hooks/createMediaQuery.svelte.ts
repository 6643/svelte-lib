import { MediaQuery } from "svelte/reactivity";

// 媒体查询: 直接返回 svelte/reactivity 的 MediaQuery 实例, 读 `.current`.
// 用法: `const mq = createMediaQuery('(min-width: 600px)')`, 模板里 `mq.current`.
//
// 与源实现的差别: 源实现 query 变化会重新订阅; 这里 query 是构造函数参数,
// 需要跟随变化时在外层用 `$derived` 的 getter 形式创建 (见 demo).
export const createMediaQuery = (query: string): MediaQuery => new MediaQuery(query);

export type MediaQueryHandle = MediaQuery;
