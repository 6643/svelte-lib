// `copied` 保持多久后自动回落.
const COPIED_RESET_MS = 2000;

// 复制到剪贴板, 成功后 copied 保持 2 秒.
//
// 用法: `const clip = createCopy()`, 模板读 `clip.copied`, 事件里调 `clip.copy(...)`.
// 复位定时器由本工厂的 `$effect` 在卸载时清掉, 调用方不需要写清理代码.
// 因此它只能在组件初始化期调用.
export const createCopy = () => {
  let copied = $state(false);
  let resetTimer: ReturnType<typeof setTimeout> | undefined;

  // copy() 是异步的: 写入可能在卸载之后才 resolve. 没有这个标志,
  // 那次 resolve 会在 cleanup 跑完之后再建一个无人清理的定时器.
  let disposed = false;

  // 只做清理, 不读任何会被自身写入的状态, 所以只跑一次
  $effect(() => {
    return () => {
      disposed = true;
      if (resetTimer === undefined) return;
      clearTimeout(resetTimer);
      resetTimer = undefined;
    };
  });

  const copy = async (data: string | Blob): Promise<void> => {
    if (!navigator.clipboard) {
      console.warn("Clipboard API not available");
      return;
    }

    try {
      if (typeof data === "string") {
        await navigator.clipboard.writeText(data);
      } else {
        if (typeof ClipboardItem === "undefined" || !navigator.clipboard.write) {
          console.error("Copying files/images to the clipboard is not supported in this browser.");
          return;
        }
        await navigator.clipboard.write([new ClipboardItem({ [data.type]: data })]);
      }

      // 写入期间组件已卸载: 不再写 state, 也不建定时器
      if (disposed) return;

      copied = true;
      if (resetTimer !== undefined) clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        resetTimer = undefined;
        copied = false;
      }, COPIED_RESET_MS);
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
      if (disposed) return;
      copied = false;
    }
  };

  return {
    get copied(): boolean {
      return copied;
    },
    copy,
  };
};

export type CopyHandle = ReturnType<typeof createCopy>;
