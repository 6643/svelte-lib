// 屏幕常亮锁: `active` 表示实际持有, `setActive` 表示意图.
// 页面重新可见时若仍想要常亮, 会重新申请 (系统会在切走后自动释放).
export const createWakeLock = () => {
  let active = $state(false);
  let desired = false;
  let wakeLock: WakeLockSentinel | null = null;

  const supported = typeof navigator !== "undefined" && "wakeLock" in navigator;

  const request = async (): Promise<void> => {
    if (!supported || !desired) return;
    if (wakeLock && !wakeLock.released) return;

    try {
      wakeLock = await navigator.wakeLock.request("screen");
      active = true;
      wakeLock.addEventListener("release", () => {
        active = false;
        wakeLock = null;
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? `${error.name}, ${error.message}` : String(error);
      console.error(`Wake Lock request failed: ${message}`);
      active = false;
      wakeLock = null;
    }
  };

  const release = async (): Promise<void> => {
    if (wakeLock) {
      try {
        await wakeLock.release();
      } catch {
        // 重复释放会抛错, 忽略即可
      }
      wakeLock = null;
    }
    active = false;
  };

  $effect(() => {
    const onVisibilityChange = () => {
      if (desired && document.visibilityState === "visible") void request();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      desired = false;
      void release();
    };
  });

  const setActive = (next: boolean) => {
    desired = next;
    if (next) void request();
    else void release();
  };

  return {
    get supported(): boolean {
      return supported;
    },
    get active(): boolean {
      return active;
    },
    setActive,
  };
};

export type WakeLockHandle = ReturnType<typeof createWakeLock>;
