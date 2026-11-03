// `svelte/internal/client` 没有发布类型; 测试只用到它的 RAF 队列 (`raf.tasks`),
// 为这一个用途补最小声明, 避免 `// @ts-expect-error` 散落在用例里.
declare module "svelte/internal/client" {
  export const raf: {
    tick(callback: (time: number) => void): void;
    now(): number;
    tasks: Set<unknown>;
  };
}
