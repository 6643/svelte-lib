// 路由子路径入口: 与 solid 的 `solid-lib/route` 对齐 (运行时 + <Route> 组件一处导出).
// 本文件不含 rune, 只做再导出; 状态本体在 route.svelte.ts.
export * from "./route.svelte.ts";
export { default as Route } from "./Route.svelte";
