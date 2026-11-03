// 系统文件框关闭后, 等这么久没收到 change 才判定为"取消".
const CANCEL_SETTLE_MS = 300;

// 弹系统文件选择框并返回选中结果, 取消时返回 null.
// 只能通过用户手势触发; 取消的判定依赖 window 的 focus 事件 + 300ms 延迟.
//
// 两条路都会摘掉另一个监听: `change` 先到时不再等 focus
// (否则回到页面后的 focus 会把已选结果覆盖成 null).
export const pickFile = (accept = "", multiple = false): Promise<FileList | null> => {
  return new Promise((resolve) => {
    const input = Object.assign(document.createElement("input"), {
      type: "file",
      accept,
      multiple,
    });

    let settled = false;
    let cancelTimer: ReturnType<typeof setTimeout> | undefined;

    const settle = (files: FileList | null) => {
      if (settled) return;
      settled = true;

      window.removeEventListener("focus", onFocus);
      clearTimeout(cancelTimer);
      resolve(files);
    };

    const onFocus = () => {
      cancelTimer = setTimeout(() => settle(null), CANCEL_SETTLE_MS);
    };

    input.onchange = (event: Event) => {
      const files = (event.target as HTMLInputElement).files;
      settle(files && files.length > 0 ? files : null);
    };

    window.addEventListener("focus", onFocus);
    input.click();
  });
};
