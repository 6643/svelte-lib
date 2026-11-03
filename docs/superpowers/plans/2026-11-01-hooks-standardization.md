# hooks 标准化 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `src/hooks/` 的生命周期归属收敛成一条规则 (工厂内部自管), 去掉逐字重复, 统一附件类型与事件监听, 并修掉 `peerDependencies` 的版本下限.

**Architecture:** 四个阶段, 每阶段独立可合入. 阶段一改生命周期语义 (破坏性), 阶段二去重与拆文件, 阶段三统一类型与事件监听, 阶段四文档与护栏. 每阶段结束跑一次全量 `vp test run` 与 `svelte-check`.

**Tech Stack:** Svelte 5.57 (runes + attachments), `svelte/events` 的 `on()`, `svelte/reactivity` 的 `createSubscriber`, vitest (vite-plus), happy-dom, TypeScript 6.

**Spec:** `docs/superpowers/specs/2026-11-01-hooks-standardization-design.md`

## Global Constraints

- 语言: 简体中文注释, ASCII 标点. 代码风格跟现有文件 (2 空格, 双引号, 箭头函数 const 导出).
- 基线: 339 个测试用例全绿, `npx svelte-check --tsconfig ./tsconfig.json` 0 错误. 每个任务结束时这两个数字不得退化.
- 不引入新依赖. 不引入 `svelte/store`.
- rune 只能出现在 `.svelte.ts` 文件里; 纯 `.ts` 文件不得含 rune.
- 内部开 `$effect` 的工厂只能在组件初始化期调用. 组件外调用会抛 `effect_orphan`, 这是预期行为, 不得用 try/catch 吞掉.
- 附件返回类型一律用 `import type { Attachment } from "svelte/attachments"` 的 `Attachment<HTMLElement>`, 不自定义别名.
- `pointer*` / `touch*` / `wheel` 事件不得改用 `on()`, 因为 `svelte/events` 把它们延后一个微任务才挂载.
- 测试命令: `npx vp test run <path>`; 类型检查: `npx svelte-check --tsconfig ./tsconfig.json`.
- 提交信息用中文短句, 不加 `Co-Authored-By` (仓库历史提交无此约定, 由提交者按需添加).

## Review Focus

- **组件外调用 `createCopy()` / `createCountdown()`**: 改造后必须抛 `effect_orphan`, 不能静默不工作. 使用者若在模块顶层创建, 应在开发时立刻看到错误而不是运行时才发现定时器没跑.
- **`$effect` 的执行时机**: 工厂自持定时器意味着"创建后不立即走, 挂载完成后才开始". 若实现写成在 `$effect` 外先跑一拍, 秒数会与现有语义不一致.
- **`$effect` 内不得读取会被自身写入的 `$state`**: 否则 effect 反复重跑, 定时器被反复重建. `createCountdown` / `createCopy` 的 effect 体内只能读 `interval` 这类常量.
- **解构调用 `createStorage` 的 `update`**: 必须仍然工作. 这是 `this` 绑定的直接回归点.
- **`on()` 的返回值被丢弃**: 每个改用 `on()` 的地方都必须把 off 函数作为 cleanup 返回, 否则监听从不解绑.

---

### Task 1: `createStorage.update` 去掉 `this` 绑定

**Files:**
- Modify: `src/hooks/createStorage.svelte.ts:36-39`
- Test: `src/hooks/state-hooks.test.ts:34-47`

**Interfaces:**
- Consumes: 无
- Produces: `createStorage<T>(key, initial, storage?) => { value: T; update(compute: (prev: T) => T): void }` — `update` 不再依赖 `this`.

- [ ] **Step 1: 写失败测试**

在 `src/hooks/state-hooks.test.ts` 的 `describe("createStorage")` 里追加:

```ts
it("update 解构后仍可调用", () => {
  localStorage.clear();
  const store = createStorage("test:destructure", { count: 1 });
  const { update } = store;

  update((prev) => ({ count: prev.count + 10 }));

  expect(store.value).toEqual({ count: 11 });
  expect(JSON.parse(localStorage.getItem("test:destructure") ?? "null")).toEqual({ count: 11 });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vp test run src/hooks/state-hooks.test.ts`
Expected: FAIL, `TypeError: Cannot set properties of undefined (setting 'value')`.

- [ ] **Step 3: 改实现**

把 `src/hooks/createStorage.svelte.ts:36-39` 的:

```ts
    /** 函数式更新: 基于当前值算出下一个值再落盘 */
    update(compute: (prev: T) => T): void {
      this.value = compute(value);
    },
```

改成闭包直接写 `value` 并落盘 (与 setter 同样的持久化逻辑):

```ts
    /** 函数式更新: 基于当前值算出下一个值再落盘 */
    update(compute: (prev: T) => T): void {
      value = compute(value);
      try {
        storage?.setItem(key, JSON.stringify(value));
      } catch {
        // 存储不可用时仅保留内存值
      }
    },
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vp test run src/hooks/state-hooks.test.ts`
Expected: PASS, 全部用例绿.

- [ ] **Step 5: 提交**

```bash
git add src/hooks/createStorage.svelte.ts src/hooks/state-hooks.test.ts
git commit -m "fix(hooks): createStorage.update 不再依赖 this, 解构调用可用"
```

---

### Task 2: `createCopy` 自管复位定时器

**Files:**
- Modify: `src/hooks/createCopy.svelte.ts`
- Create: `test/fixtures/CopyProbe.svelte`
- Test: `src/hooks/state-hooks.test.ts:49-67,145-165`

**Interfaces:**
- Consumes: 无
- Produces: `createCopy() => { readonly copied: boolean; copy(data: string | Blob): Promise<void> }` — **不再有 `dispose`**. 必须在组件初始化期调用.

> 用专用 fixture 而非复用 `SignalProbe`: 后者同时挂了 `createDebouncedSignal`, 它内部也会产生定时器, 会污染 `vi.getTimerCount()` 的断言.

- [ ] **Step 1: 建专用 fixture**

创建 `test/fixtures/CopyProbe.svelte`:

```svelte
<script lang="ts">
	import { createCopy } from '../../src/hooks/createCopy.svelte.ts';

	const copy = createCopy();
</script>

<span class="copied">{String(copy.copied)}</span>
<button type="button" class="copy" onclick={() => void copy.copy('hello')}>copy</button>
```

- [ ] **Step 2: 写失败测试**

把 `src/hooks/state-hooks.test.ts` 里 `describe("createCopy")` 与 `describe("createCopy dispose")` 两个块**整体替换**为:

```ts
describe("createCopy", () => {
  it("调用 clipboard.writeText 并在 2 秒后回落", async () => {
    vi.useFakeTimers();
    const writeText = vi.fn(async () => {});
    vi.stubGlobal("navigator", {
      clipboard: { writeText, write: vi.fn() },
      wakeLock: undefined,
    });

    const { container } = render(CopyProbe, {});
    (container.querySelector(".copy") as HTMLButtonElement).click();
    await tick();

    expect(writeText).toHaveBeenCalledWith("hello");
    expect(container.querySelector(".copied")?.textContent).toBe("true");

    await vi.advanceTimersByTimeAsync(2000);
    await tick();
    expect(container.querySelector(".copied")?.textContent).toBe("false");
  });

  it("卸载后待复位的定时器被清掉", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("navigator", {
      clipboard: { writeText: vi.fn(async () => {}), write: vi.fn() },
      wakeLock: undefined,
    });

    const { container, unmount } = render(CopyProbe, {});
    (container.querySelector(".copy") as HTMLButtonElement).click();
    await tick();
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    unmount();
    expect(vi.getTimerCount()).toBe(0);

    // 推进时钟不应抛错 (定时器已清, 不会再写已销毁组件的 state)
    await vi.advanceTimersByTimeAsync(3000);
  });
});
```

同时把文件顶部 `import SignalProbe from "../../test/fixtures/SignalProbe.svelte";` 保留, 新增 `import CopyProbe from "../../test/fixtures/CopyProbe.svelte";`, 并删除 `import { createCopy } from "./createCopy.svelte.ts";` 这一行.

- [ ] **Step 3: 运行测试确认失败**

Run: `npx vp test run src/hooks/state-hooks.test.ts`
Expected: FAIL. 第一个用例失败于 "卸载后定时器仍在", 第二个用例 `unmount()` 后 `vi.getTimerCount()` 仍大于 0.

- [ ] **Step 4: 改实现**

把 `src/hooks/createCopy.svelte.ts` 改成 (删除 `dispose` 导出, 加内部 `$effect`):

```ts
/** `copied` 保持多久后自动回落. */
const COPIED_RESET_MS = 2000;

/**
 * 复制到剪贴板, 成功后 copied 保持 2 秒.
 *
 * 用法: `const clip = createCopy()`, 模板读 `clip.copied`, 事件里调 `clip.copy(...)`.
 * 复位定时器由本工厂的 `$effect` 在卸载时清掉, 调用方不需要写清理代码.
 * 因此它只能在组件初始化期调用.
 */
export const createCopy = () => {
  let copied = $state(false);
  let resetTimer: ReturnType<typeof setTimeout> | undefined;

  // 只做清理, 不读任何会被自身写入的状态, 所以只跑一次
  $effect(() => {
    return () => {
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

      copied = true;
      if (resetTimer !== undefined) clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        resetTimer = undefined;
        copied = false;
      }, COPIED_RESET_MS);
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
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
```

- [ ] **Step 5: 运行测试确认通过**

Run: `npx vp test run src/hooks/state-hooks.test.ts`
Expected: PASS.

- [ ] **Step 6: 提交**

```bash
git add src/hooks/createCopy.svelte.ts src/hooks/state-hooks.test.ts test/fixtures/CopyProbe.svelte
git commit -m "refactor(hooks): createCopy 自管复位定时器, 删除 dispose"
```

---

### Task 3: `createCountdown` 自管 interval

**Files:**
- Create: `test/fixtures/CountdownProbe.svelte`
- Modify: `src/hooks/createCountdown.svelte.ts`
- Modify: `src/CountDown.svelte:45`
- Test: `src/hooks/createCountdown.test.ts`

**Interfaces:**
- Consumes: 无
- Produces: `createCountdown(options: { initial: number; onDone?: () => void; interval?: number }) => { readonly remaining: number; tick(): void }` — **不再有 `start()`**. 挂载后自动起表, 卸载自动停表.

- [ ] **Step 1: 建 fixture**

创建 `test/fixtures/CountdownProbe.svelte`:

```svelte
<script lang="ts">
	import { createCountdown } from '../../src/hooks/createCountdown.svelte.ts';

	type Props = { initial?: number; interval?: number; onDone?: () => void };
	let { initial = 3, interval, onDone }: Props = $props();

	const countdown = createCountdown({ initial, interval, onDone });
</script>

<span class="remaining">{countdown.remaining}</span>
```

- [ ] **Step 2: 写失败测试**

把 `src/hooks/createCountdown.test.ts` 整体替换为:

```ts
import { describe, expect, it, vi } from "vite-plus/test";
import { render } from "@testing-library/svelte";
import { tick } from "svelte";
import CountdownProbe from "../../test/fixtures/CountdownProbe.svelte";
import { createCountdown } from "./createCountdown.svelte.ts";

const remaining = (el: HTMLElement): string | undefined =>
  el.querySelector(".remaining")?.textContent ?? undefined;

describe("createCountdown", () => {
  it("挂载后每秒减一, 到 0 时恰好回调一次", async () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    const { container } = render(CountdownProbe, { props: { initial: 2, onDone } });

    expect(remaining(container)).toBe("2");

    await vi.advanceTimersByTimeAsync(1000);
    await tick();
    expect(remaining(container)).toBe("1");
    expect(onDone).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000);
    await tick();
    expect(remaining(container)).toBe("0");
    expect(onDone).toHaveBeenCalledTimes(1);

    // 再走两拍也不会重复回调
    await vi.advanceTimersByTimeAsync(2000);
    await tick();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("卸载后停表", async () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    const { container, unmount } = render(CountdownProbe, { props: { initial: 5, onDone } });

    await vi.advanceTimersByTimeAsync(1000);
    await tick();
    expect(remaining(container)).toBe("4");

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("自定义间隔生效", async () => {
    vi.useFakeTimers();
    const { container } = render(CountdownProbe, { props: { initial: 5, interval: 100 } });

    await vi.advanceTimersByTimeAsync(200);
    await tick();
    expect(remaining(container)).toBe("3");
  });

  it("tick 是纯数据推进, 不依赖时钟", () => {
    const onDone = vi.fn();
    const countdown = createCountdown({ initial: 0, onDone });

    countdown.tick();
    expect(onDone).toHaveBeenCalledTimes(1);

    // 已结算, 再推也不重复
    countdown.tick();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("在组件外创建会抛 effect_orphan", () => {
    expect(() => createCountdown({ initial: 3 })).toThrow(/effect_orphan/);
  });
});
```

- [ ] **Step 3: 运行测试确认失败**

Run: `npx vp test run src/hooks/createCountdown.test.ts`
Expected: FAIL, 编译错误 `Property 'start' does not exist` 不会出现, 但首个用例会失败于 `remaining` 不变 (interval 未自启), 且 `effect_orphan` 用例失败于 "did not throw".

- [ ] **Step 4: 改实现**

把 `src/hooks/createCountdown.svelte.ts` 改成:

```ts
/**
 * 倒数计时器: 每秒减一, 到 0 时恰好触发一次 `onDone`.
 *
 * 定时器由本工厂的 `$effect` 起停: 挂载后开始走, 卸载时自动停.
 * 调用方不需要写 `$effect(() => countdown.start())`, 因此只能在组件初始化期调用.
 *
 * 不变量: 剩余秒数减到 0 的那一拍就结算并停表, 因此 `onDone` 不可能触发两次.
 */
export const createCountdown = (options: {
  initial: number;
  onDone?: () => void;
  interval?: number;
}) => {
  const interval = options.interval ?? 1000;
  let remaining = $state(options.initial);

  /** 结算: 停表并回调一次. 由 effect 的清理负责停表, 这里只切标志. */
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
    /** 手动推进一拍 (单测与外力驱动用) */
    tick: run,
  };
};

export type CountdownHandle = ReturnType<typeof createCountdown>;
```

- [ ] **Step 5: 删掉组件里的手写启动**

把 `src/CountDown.svelte` 里这行 (含上方注释) 删掉:

```svelte
	// 计时器只在挂载期间跑, 卸载时由清理函数停表
	$effect(() => countdown.start());
```

- [ ] **Step 6: 运行测试确认通过**

Run: `npx vp test run src/hooks/createCountdown.test.ts`
Expected: PASS.

- [ ] **Step 7: 跑全量, 确认没有其它地方依赖 `start()`**

Run: `npx vp test run && npx svelte-check --tsconfig ./tsconfig.json`
Expected: 全绿, 0 错误.

- [ ] **Step 8: 提交**

```bash
git add src/hooks/createCountdown.svelte.ts src/hooks/createCountdown.test.ts src/CountDown.svelte test/fixtures/CountdownProbe.svelte
git commit -m "refactor(hooks): createCountdown 自管 interval, 删除 start()"
```

---

### Task 4: `observer.ts` 提公共骨架, `useResize` / `useVis` 去重

**Files:**
- Modify: `src/hooks/observer.ts`
- Modify: `src/hooks/useResize.ts`
- Modify: `src/hooks/useVis.ts`
- Test: `src/hooks/createObservers.test.ts`

**Interfaces:**
- Consumes: 无
- Produces: `observerAttachment<E>(Ctor: ObserverCtor<E> | undefined, notify: (entries: E[]) => void): Attachment<HTMLElement>`. 保留 `observe` 作为同名别名, 使 `createSize` / `createVisibility` 零改动 (规格非目标里明确不改它们的 `{ current, attach }` 形态).

- [ ] **Step 1: 写失败测试**

在 `src/hooks/createObservers.test.ts` 末尾追加:

```ts
import { observerAttachment } from "./observer.ts";

describe("observerAttachment", () => {
  it("给元素挂上观察者, cleanup 时断开", () => {
    const fake = createFakeObserver<ResizeObserverEntry>();
    const attach = observerAttachment(fake.Ctor, () => {});
    const el = document.createElement("div");

    const cleanup = attach(el);
    expect(fake.observed).toBe(el);

    cleanup?.();
    expect(fake.disconnected).toBe(true);
  });

  it("构造器缺失时返回空 cleanup 且不抛错", () => {
    const attach = observerAttachment<ResizeObserverEntry>(undefined, () => {});
    const cleanup = attach(document.createElement("div"));

    expect(() => cleanup?.()).not.toThrow();
  });

  it("把整批记录原样交给 notify", () => {
    const fake = createFakeObserver<ResizeObserverEntry>();
    const seen: ResizeObserverEntry[][] = [];
    observerAttachment(fake.Ctor, (entries) => { seen.push(entries); })(document.createElement("div"));

    const batch = [entry(1, 1), entry(2, 2)];
    fake.emit(batch);
    expect(seen).toEqual([batch]);
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vp test run src/hooks/createObservers.test.ts`
Expected: FAIL, `observerAttachment is not a function`.

- [ ] **Step 3: 在 `observer.ts` 加导出**

在 `src/hooks/observer.ts` 末尾追加 (保留现有 `observe`, 内部改为委托, 避免 `createSize` / `createVisibility` 同时改动):

```ts
/**
 * 附件形态的观察者挂载: 每个元素一个独立 observer, 返回 `(el) => cleanup`.
 *
 * 运行时不支持该观察者 (SSR / 老环境) 时返回不挂载的附件.
 */
export const observerAttachment =
  <E>(Ctor: ObserverCtor<E> | undefined, notify: (entries: E[]) => void): Attachment<HTMLElement> =>
  (el: HTMLElement): (() => void) => {
    if (!Ctor) return () => {};

    const observer = new Ctor(notify);
    observer.observe(el);
    return () => observer.disconnect();
  };
```

文件顶部加 import:

```ts
import type { Attachment } from "svelte/attachments";
```

把原 `observe` 的实现改为一行委托:

```ts
export const observe = observerAttachment;
```

- [ ] **Step 4: 把 `useResize` / `useVis` 缩成一次调用**

`src/hooks/useResize.ts` 整体替换为:

```ts
import type { Attachment } from "svelte/attachments";
import { getCtor, observerAttachment } from "./observer.ts";

/** 元素尺寸变化时回调. 用法: `<div {@attach useResize((entry) => ...)}>`. */
export const useResize =
  (callback: (entry: ResizeObserverEntry) => void): Attachment<HTMLElement> =>
  (el: HTMLElement): (() => void) =>
    observerAttachment<ResizeObserverEntry>(getCtor("ResizeObserver"), (entries) => {
      // 一个附件只观察一个元素, 一批里的最后一条就是最新状态
      const entry = entries[entries.length - 1];
      if (entry) callback(entry);
    })(el);
```

`src/hooks/useVis.ts` 同理, 只改名字与注释:

```ts
import type { Attachment } from "svelte/attachments";
import { getCtor, observerAttachment } from "./observer.ts";

/** 进入/离开视口时回调. 用法: `<div {@attach useVis((entry) => ...)}>`. */
export const useVis =
  (callback: (entry: IntersectionObserverEntry) => void): Attachment<HTMLElement> =>
  (el: HTMLElement): (() => void) =>
    observerAttachment<IntersectionObserverEntry>(getCtor("IntersectionObserver"), (entries) => {
      // 一个附件只观察一个元素, 一批里的最后一条就是最新状态
      const entry = entries[entries.length - 1];
      if (entry) callback(entry);
    })(el);
```

- [ ] **Step 5: 运行测试确认通过**

Run: `npx vp test run src/hooks/createObservers.test.ts src/hooks/dom-hooks.test.ts && npx svelte-check --tsconfig ./tsconfig.json`
Expected: PASS, 0 错误.

- [ ] **Step 6: 提交**

```bash
git add src/hooks/observer.ts src/hooks/useResize.ts src/hooks/useVis.ts src/hooks/createObservers.test.ts
git commit -m "refactor(hooks): 观测类 hook 共用 observerAttachment 骨架"
```

---

### Task 5: `useLoadMore` 拆出独立文件

**Files:**
- Create: `src/hooks/useLoadMore.ts`
- Modify: `src/hooks/createLoad.svelte.ts:73-84` (删除 `useLoadMore`)
- Modify: `src/index.ts:126`
- Modify: `src/LoadMore.svelte:3`
- Test: `src/hooks/scroll-hooks.test.ts`

**Interfaces:**
- Consumes: `LoadHandle` from Task 5 的 `createLoad.svelte.ts` (不变)
- Produces: `useLoadMore(handle: LoadHandle, threshold?: number): Attachment<HTMLElement>` — 从 `./hooks/useLoadMore.ts` 导出.

- [ ] **Step 1: 写失败测试**

在 `src/hooks/scroll-hooks.test.ts` 末尾追加:

```ts
import { useLoadMore } from "./useLoadMore.ts";

describe("useLoadMore", () => {
  it("从独立文件导出, 且挂在元素上可卸载", () => {
    const handle = {
      page: 0,
      hasMore: true,
      loading: false,
      load: async () => {},
      reset: () => {},
      wants: () => false,
    };
    const attach = useLoadMore(handle);
    const cleanup = attach(document.createElement("div"));

    expect(typeof cleanup).toBe("function");
    expect(() => cleanup?.()).not.toThrow();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vp test run src/hooks/scroll-hooks.test.ts`
Expected: FAIL, `Failed to resolve import "./useLoadMore.ts"`.

- [ ] **Step 3: 建文件**

创建 `src/hooks/useLoadMore.ts`:

```ts
import type { Attachment } from "svelte/attachments";
import { useScrollEnd } from "./useScrollEnd.ts";
import type { LoadHandle } from "./createLoad.svelte.ts";

/**
 * 把滚动容器接到 load 句柄上: 滚动停止后若接近视口底部就拉下一页.
 * 用法: `<main {@attach useLoadMore(handle)}>`.
 *
 * 挂载时不会自动拉第一页, 首屏由使用方调 `handle.reset(el)` 起步.
 */
export const useLoadMore =
  (handle: LoadHandle, threshold = 320): Attachment<HTMLElement> =>
  (el: HTMLElement): (() => void) =>
    useScrollEnd(() => {
      if (handle.wants(el, threshold)) void handle.load();
    })(el);
```

- [ ] **Step 4: 从 `createLoad.svelte.ts` 删除旧实现**

删除 `src/hooks/createLoad.svelte.ts` 里 `useLoadMore` 的整个定义 (从 `/**` 注释到文件末), 以及顶部 `import { useScrollEnd } from "./useScrollEnd.ts";` 这一行.

- [ ] **Step 5: 更新引用**

`src/index.ts:126` 改为:

```ts
export { createLoad } from "./hooks/createLoad.svelte.ts";
export { useLoadMore } from "./hooks/useLoadMore.ts";
```

`src/LoadMore.svelte:3` 改为:

```ts
	import { createLoad, type LoadMoreFn } from './hooks/createLoad.svelte.ts';
	import { useLoadMore } from './hooks/useLoadMore.ts';
```

`test/fixtures/ScrollProbe.svelte` 的 import 同样拆成两行.

- [ ] **Step 6: 运行测试确认通过**

Run: `npx vp test run && npx svelte-check --tsconfig ./tsconfig.json`
Expected: 全绿, 0 错误.

- [ ] **Step 7: 提交**

```bash
git add src/hooks/useLoadMore.ts src/hooks/createLoad.svelte.ts src/index.ts src/LoadMore.svelte test/fixtures/ScrollProbe.svelte src/hooks/scroll-hooks.test.ts
git commit -m "refactor(hooks): useLoadMore 拆出独立文件"
```

---

### Task 6: 删除 `useRefresh.ts` 的 re-export

**Files:**
- Modify: `src/hooks/useRefresh.ts:3-11`
- Modify: `src/index.ts:109-111`

**Interfaces:**
- Consumes: `createPullRefresh` 及其常量 (不变)
- Produces: `useRefresh(refresh: () => Promise<void>): Attachment<HTMLElement>` — 只导出这一个符号. `PullState` / `PULL_CLASS` 改由 `index.ts` 直接从 `createPullRefresh.svelte.ts` 导出, 公开 API 不变.

- [ ] **Step 1: 确认没有外部引用被删的常量**

Run: `grep -rn "REFRESH_THRESHOLD\|MAX_PULL_HEIGHT\|PULL_DAMPING_FACTOR\|DONE_ANIMATION_DURATION_MS" src demo test --include=*.ts --include=*.svelte | grep -v "createPullRefresh.svelte.ts"`
Expected: 无输出. 若有, 把对应 import 改到 `./createPullRefresh.svelte.ts`.

- [ ] **Step 2: 改 `useRefresh.ts`**

把顶部的 `export { ... }` 与 `export type { ... }` 两个块 (第 3-11 行) 整体删除, 只保留 `import` 与 `useRefresh` 定义:

```ts
import { PULL_CLASS, PullState, createPullRefresh } from "./createPullRefresh.svelte.ts";
```

- [ ] **Step 3: 补 `Attachment` 类型标注**

把 `useRefresh` 的返回类型标为 `Attachment<HTMLElement>`, 文件顶部加 import. 函数签名改为:

```ts
export const useRefresh =
  (refresh: () => Promise<void>): Attachment<HTMLElement> =>
  (el: HTMLElement): (() => void) => {
```

- [ ] **Step 4: 更新 `index.ts`**

把 `src/index.ts:109` 改为:

```ts
export { useRefresh } from "./hooks/useRefresh.ts";
export { PullState, PULL_CLASS } from "./hooks/createPullRefresh.svelte.ts";
```

- [ ] **Step 5: 运行测试确认通过**

Run: `npx vp test run && npx svelte-check --tsconfig ./tsconfig.json`
Expected: 全绿, 0 错误.

- [ ] **Step 6: 提交**

```bash
git add src/hooks/useRefresh.ts src/index.ts
git commit -m "refactor(hooks): useRefresh 不再 re-export 状态机常量"
```

---

### Task 7: 附件类型统一为官方 `Attachment`

**Files:**
- Modify: `src/hooks/useScrollEnd.ts:3`
- Modify: `src/hooks/useClickOutside.ts`
- Modify: `src/hooks/useGestures.ts:81,130`
- Modify: `src/hooks/useKeepScroll.ts:26`
- Modify: `src/hooks/useMutation.ts:16`
- Modify: `src/index.ts:107`
- Test: 无新增 (类型检查即验证)

**Interfaces:**
- Consumes: `Attachment` from `svelte/attachments`
- Produces: 所有附件 hook 的返回类型统一为 `Attachment<HTMLElement>` (或 `Attachment<Element>` 当目标可为任意元素).

- [ ] **Step 1: 先跑一次类型检查确认基线**

Run: `npx svelte-check --tsconfig ./tsconfig.json`
Expected: 0 错误. (改动前记下这个状态.)

- [ ] **Step 2: 删自定义别名**

删除 `src/hooks/useScrollEnd.ts:3` 的:

```ts
export type ScrollEndAttachment = (el: HTMLElement) => () => void;
```

改为在文件顶部加:

```ts
import type { Attachment } from "svelte/attachments";
```

并把 `useScrollEnd` 的返回类型标为 `Attachment<HTMLElement>`.

同时删除 `src/index.ts:107` 的 `export type { ScrollEndAttachment } ...`.

- [ ] **Step 3: 逐个标注剩余附件 hook**

对下列文件, 在顶部加 `import type { Attachment } from "svelte/attachments";`, 并把返回类型标为 `Attachment<HTMLElement>`:

- `src/hooks/useClickOutside.ts` — 注意它的参数是 `Element` 而非 `HTMLElement`, 用 `Attachment<Element>`
- `src/hooks/useGestures.ts` — `useTap` 与 `useLongPress` 两个
- `src/hooks/useKeepScroll.ts` — `useKeepScroll`
- `src/hooks/useMutation.ts` — `useMutation`

`useClickOutside` 的 `(el: Element): (() => void) | void` 保持 `| void` (它可能提前返回).

- [ ] **Step 4: 运行类型检查确认通过**

Run: `npx svelte-check --tsconfig ./tsconfig.json && npx vp test run`
Expected: 0 错误, 全绿.

- [ ] **Step 5: 提交**

```bash
git add src/hooks/useScrollEnd.ts src/hooks/useClickOutside.ts src/hooks/useGestures.ts src/hooks/useKeepScroll.ts src/hooks/useMutation.ts src/index.ts
git commit -m "refactor(hooks): 附件类型统一用 svelte/attachments 的 Attachment"
```

---

### Task 8: 事件监听改用 `svelte/events` 的 `on()`

**Files:**
- Modify: `src/hooks/useClickOutside.ts:17-18`
- Modify: `src/hooks/useScrollEnd.ts:17-22`
- Modify: `src/hooks/useKeyPress.svelte.ts:24-25`
- Modify: `src/hooks/createFullscreen.svelte.ts:13-14`
- Modify: `src/hooks/useGestures.ts` (加注释, 不改实现)
- Modify: `src/hooks/useRefresh.ts` (加注释, 不改实现)
- Test: `src/hooks/dom-hooks.test.ts` (现有用例应全部保持绿)

**Interfaces:**
- Consumes: `on` from `svelte/events`
- Produces: 无 API 变化, 只是实现内的监听方式.

- [ ] **Step 1: 先跑一次现有测试确认基线**

Run: `npx vp test run src/hooks/dom-hooks.test.ts src/hooks/state-hooks.test.ts`
Expected: 全绿.

- [ ] **Step 2: 改 `useClickOutside`**

把:

```ts
    document.body.addEventListener("mousedown", onClick);
    return () => document.body.removeEventListener("mousedown", onClick);
```

改为 (顶部加 `import { on } from "svelte/events";`):

```ts
    return on(document.body, "mousedown", onClick);
```

- [ ] **Step 3: 改 `useScrollEnd`**

把:

```ts
    el.addEventListener("scroll", listener, { passive: true });

    return () => {
      debounced.cancel();
      el.removeEventListener("scroll", listener);
    };
```

改为:

```ts
    const off = on(el, "scroll", listener, { passive: true });

    return () => {
      debounced.cancel();
      off();
    };
```

- [ ] **Step 4: 改 `useKeyPress`**

把:

```ts
    window.addEventListener("keydown", onKeyDown, { capture });
    return () => window.removeEventListener("keydown", onKeyDown, { capture });
```

改为:

```ts
    return on(window, "keydown", onKeyDown, { capture });
```

- [ ] **Step 5: 改 `createFullscreen`**

把:

```ts
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
```

改为:

```ts
    return on(document, "fullscreenchange", handler);
```

- [ ] **Step 6: 给保留 `addEventListener` 的两处加注释**

在 `src/hooks/useGestures.ts` 的 `pointerEvents` 函数体内 (监听注册那几行上方) 加:

```ts
    // 保留 addEventListener 而非 svelte/events 的 on(): 源码 events.js 会把
    // pointer* / touch* / wheel 延后一个微任务才真正挂载 (规避 Chrome cloneNode bug),
    // 而手势依赖同步挂载
```

在 `src/hooks/useRefresh.ts` 的监听注册那几行上方加同样原因的注释.

- [ ] **Step 7: 运行测试确认通过**

Run: `npx vp test run && npx svelte-check --tsconfig ./tsconfig.json`
Expected: 全绿, 0 错误.

- [ ] **Step 8: 提交**

```bash
git add src/hooks/useClickOutside.ts src/hooks/useScrollEnd.ts src/hooks/useKeyPress.svelte.ts src/hooks/createFullscreen.svelte.ts src/hooks/useGestures.ts src/hooks/useRefresh.ts
git commit -m "refactor(hooks): 事件监听改用 svelte/events 的 on()"
```

---

### Task 9: 删除空测试, 补真实覆盖

**Files:**
- Modify: `src/hooks/dom-hooks.test.ts:118-131`
- Test: `src/hooks/createObservers.test.ts` (已在 Task 4 覆盖)

**Interfaces:**
- Consumes: 无
- Produces: 无 API 变化.

- [ ] **Step 1: 确认要删的用例**

Run: `sed -n 112,122p src/hooks/dom-hooks.test.ts`
Expected: 看到 `it("useResize / useVis 能挂上观察者", ...)`, 内容是自己 new 两个 observer, 断言 `typeof ResizeObserver === "function"`. hook 的 `onResize` / `onVis` 从未被断言.

- [ ] **Step 2: 删除该用例**

从 `src/hooks/dom-hooks.test.ts` 删除整个 `it("useResize / useVis 能挂上观察者", async () => { ... });` 块 (第 112-122 行, 到断言后的 `});` 为止).

- [ ] **Step 3: 连带删掉不再使用的 prop 与附件**

`HookProbe.svelte` 里 `onResize` / `onVis` 只被这条测试使用 (已核实: `useResize` 在 `src/` 里另有 `Tab.svelte:179` 的真实调用, 不受影响). 从 `test/fixtures/HookProbe.svelte` 删除:

- `import { useResize } from '../../src/hooks/useResize.ts';` (第 6 行)
- `import { useVis } from '../../src/hooks/useVis.ts';` (第 7 行)
- `onResize?: () => void;` 与 `onVis?: () => void;` (第 17-18 行)
- 解构里的 `onResize,` 与 `onVis,` (第 29-30 行)
- `{@attach useResize(() => onResize?.())}` 与 `{@attach useVis(() => onVis?.())}` (第 49-50 行)

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vp test run && npx svelte-check --tsconfig ./tsconfig.json`
Expected: 全绿 (用例总数会比基线少 1), 0 错误.

- [ ] **Step 5: 提交**

```bash
git add src/hooks/dom-hooks.test.ts test/fixtures/HookProbe.svelte
git commit -m "test(hooks): 删除 useResize/useVis 的空测试, 由假构造器用例覆盖"
```

---

### Task 10: 停用 `selectRelevantMutations` 的公开导出

**Files:**
- Modify: `src/index.ts:99`
- Modify: `src/hooks/useMutation.ts:3-8` (改为非导出)

**Interfaces:**
- Consumes: 无
- Produces: `selectRelevantMutations` 不再是包级公开 API, 仅模块内使用.

- [ ] **Step 1: 确认无外部引用**

Run: `grep -rn "selectRelevantMutations" src demo test --include=*.ts --include=*.svelte | grep -v "hooks/useMutation.ts"`
Expected: 无输出 (除 `index.ts` 的导出行).

- [ ] **Step 2: 改 `index.ts`**

把 `src/index.ts:99` 改为:

```ts
export { useMutation } from "./hooks/useMutation.ts";
```

- [ ] **Step 3: 改 `useMutation.ts`**

把 `export const selectRelevantMutations` 改为 `const selectRelevantMutations`, 并在函数上方保留注释.

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vp test run src/public-api.test.ts src/hooks/dom-hooks.test.ts && npx svelte-check --tsconfig ./tsconfig.json`
Expected: PASS, 0 错误. (`public-api.test.ts` 的清单里本就没有这个名字, 所以不会红.)

- [ ] **Step 5: 提交**

```bash
git add src/index.ts src/hooks/useMutation.ts
git commit -m "refactor(hooks): selectRelevantMutations 收回为模块内部函数"
```

---

### Task 11: 收紧 `peerDependencies` 版本下限

**Files:**
- Modify: `package.json:57`

**Interfaces:**
- Consumes: 无
- Produces: `peerDependencies.svelte = "^5.29.0"`

- [ ] **Step 1: 确认实际使用的最低版本要求**

Run: `grep -rn "@since" node_modules/svelte/types/index.d.ts | grep -E "5\.29|5\.7" | head`
Expected: 看到 `@since 5.29` (attachment) 与 `@since 5.7.0` (createSubscriber / MediaQuery / prefersReducedMotion). 最高要求是 5.29.

- [ ] **Step 2: 改 package.json**

把:

```json
  "peerDependencies": {
    "svelte": "^5.0.0"
  }
```

改为:

```json
  "peerDependencies": {
    "svelte": "^5.29.0"
  }
```

- [ ] **Step 3: 验证 JSON 合法**

Run: `node -e "const p=require('./package.json'); console.log(p.peerDependencies.svelte)"`
Expected: 输出 `^5.29.0`.

- [ ] **Step 4: 提交**

```bash
git add package.json
git commit -m "chore: peerDependencies 收紧到 svelte ^5.29.0 (attachment 语法要求)"
```

---

### Task 12: 重写 README 的命名约定与 hooks 表格

**Files:**
- Modify: `README.md:126-139` (命名约定)
- Modify: `README.md:141-175` (hooks 表格与附件用法示例)

**Interfaces:**
- Consumes: 前 11 个任务确定的最终 API 形态
- Produces: 无代码

- [ ] **Step 1: 重写分层与命名约定段落**

把 `README.md:126-139` 改为:

```markdown
- `src/hooks/` — 依赖 Svelte 运行时: 用 runes (`$state` / `$effect`) 或 attachment 形态,
  必须在组件初始化期间调用 (rune / 附件只在组件上下文里生效).
  生命周期一律由 hook 自己收尾, 调用方不写清理代码.
- `src/utils/` — 与框架无关的纯函数: 没有 runes, 在普通 `.ts` 里也能 import 和调用.

命名约定 (文件名 == 主导出名, 唯一例外是同类多导出的聚合文件):

- `createXxx` — **工厂**: 调用后产出一个带状态/方法的对象, 状态字段是 `$state`,
  读属性即订阅, 可直接 `bind:` (如 `bind:value={store.value}`). 工厂内部用 `$effect`
  或 `createSubscriber` 自己管生命周期, 调用方不需要 `dispose` 或 `start`.
  例如 `createTry` / `createCopy` / `createStorage` / `createCountdown`.
- `useXxx` — **组件上下文绑定**: 元素绑定返回附件 `(el) => cleanup`, 用法
  `{@attach useXxx(...)}`, 元素由 Svelte 注入, 挂载/卸载自动管理, 调用点读到的状态
  变化时会先清理再重挂; 全局绑定 (window / document) 内部开 `$effect`, 返回 `void`.
  例如 `useClickOutside` / `useScrollEnd` / `useKeyPress`.
- 无前缀动词 — 一次性动作或纯转换, 无状态. 例如 `pickFile` / `scaleImage`.
- `*.svelte.ts` 后缀 — 只有含 runes 的文件才需要, 以便 Svelte 编译器处理; 纯 `.ts` 不带.
```

- [ ] **Step 2: 更新 hooks 表格**

把 `README.md:141-155` 的表格里这些行改掉:

- `createCopy()` 说明改为 "剪贴板写入 + `copied` 标记 (无需 dispose)"
- `createCountdown(initial, onDone)` 说明改为 "倒数计时, 挂载即走, 卸载即停"
- 删除 `useKeyPress` 在 "DOM 监听 (附件形态, 给回调)" 行里的位置, 单独加一行:
  `| `useKeyPress` | 全局按键监听 (`$effect` 形态, 返回 void) |`
- `useRefresh` + `createPullRefresh` 行的表述保持, 但确认不再提 "常量从 useRefresh 导出"

- [ ] **Step 3: 检查附件用法示例仍正确**

Run: `sed -n 168,185p README.md`
Expected: 示例里没有已删除的 API (`dispose` / `start`).

- [ ] **Step 4: 提交**

```bash
git add README.md
git commit -m "docs: 按生命周期归属重写 hooks 命名约定"
```

---

## 自审

### 1. 规格覆盖

| 规格条目 | 对应任务 |
| --- | --- |
| 规则一: 生命周期归工厂 | Task 2 (copy), Task 3 (countdown) |
| 规则二: `useXxx` 语义放宽 | Task 12 (README 定义) |
| 规则三: 附件类型用官方 `Attachment` | Task 4, 5, 6, 7 |
| 规则四: 事件监听走 `on()` | Task 8 |
| 缺陷 1: `createCopy` 泄漏 | Task 2 |
| 缺陷 2: `createCountdown` 手写启动 | Task 3 |
| 缺陷 3: `createStorage.update` 的 `this` | Task 1 |
| 缺陷 4: `useResize` / `useVis` 重复 | Task 4 |
| 缺陷 5: `useLoadMore` 位置错误 | Task 5 |
| 缺陷 6: `useRefresh` re-export | Task 6 |
| 缺陷 7: 自定义附件别名 | Task 7 |
| 缺陷 8: `selectRelevantMutations` 公开 | Task 10 |
| 缺陷 9: peerDependencies 版本 | Task 11 |
| 缺陷 10: 空测试 | Task 9 |
| README 同步 | Task 12 |

无遗漏.

### 2. 步骤扫描

每个失败测试都写了具体断言与期望失败原因; 每个实现步骤给了确切签名与文件位置; 没有 "handle edge cases" 这类空步骤.

### 3. 类型一致性

- `Attachment<HTMLElement>` 在 Task 4/5/6/7 统一使用; `Attachment<Element>` 仅 `useClickOutside` (目标可为任意 Element).
- `observerAttachment` 在 Task 4 定义, Task 4 内即使用, 无跨任务名字漂移.
- `useLoadMore` 在 Task 5 从 `createLoad.svelte.ts` 移到 `useLoadMore.ts`, Task 5 内同步改完所有引用 (已核实引用点: `src/index.ts:126`, `src/LoadMore.svelte:3`, `test/fixtures/ScrollProbe.svelte:5`).
- `createCountdown` 的 `tick` 在 Task 3 保留, 规格与测试一致.
- `createCopy` 的 `copy` 保留, 只删 `dispose`. `CopyHandle` 类型仍从 `index.ts:121` 导出, 形态自动跟随.
- Task 2 与 Task 3 各自新建专用 fixture, 不复用 `SignalProbe`, 避免其它 hook 的定时器污染 `vi.getTimerCount()`.

### 4. 复查重点的测试归属

- 组件外调用抛 `effect_orphan`: Task 3 Step 2 的最后一个用例.
- `$effect` 执行时机 (挂载后才走): Task 3 Step 2 的首个用例断言 `remaining` 初值为 `initial`, 推进时钟才变.
- `$effect` 内不得读自身写入的 state: Task 3 实现的注释 + Task 2 实现的注释, 并由 "卸载后定时器清零" 用例间接验证.
- 解构调用 `createStorage.update`: Task 1 Step 1 的直接用例.
- `on()` 的 off 被返回: Task 8 的四个改动都返回 `on(...)` 的 off; 由 `dom-hooks.test.ts` 现有用例 (外部点击 / 滚动 / 按键 / 全屏) 与 Task 2/3 的卸载清零用例共同守卫.
