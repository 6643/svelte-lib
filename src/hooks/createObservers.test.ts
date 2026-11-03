import { describe, expect, it } from "vite-plus/test";
import { createSize } from "./createSize.svelte.ts";
import { createVisibility } from "./createVisibility.svelte.ts";
import { observerAttachment, type ObserverCtor } from "./observer.ts";

// 可手动驱动的假观察者: 用来断言工厂对观察结果的响应, 不依赖真实布局.
const createFakeObserver = <E>() => {
  let notify: ((entries: E[]) => void) | undefined;
  let observed: Element | undefined;
  let disconnected = false;

  const Ctor = class {
    constructor(callback: (entries: E[]) => void) {
      notify = callback;
    }
    observe(el: Element) {
      observed = el;
    }
    disconnect() {
      disconnected = true;
    }
  } as unknown as ObserverCtor<E>;

  return {
    Ctor,
    emit: (entries: E[]) => notify?.(entries),
    get observed() {
      return observed;
    },
    get disconnected() {
      return disconnected;
    },
  };
};

const entry = (width: number, height: number) =>
  ({ contentRect: { width, height } }) as unknown as ResizeObserverEntry;

describe("createSize", () => {
  it("未观测前是 0", () => {
    const fake = createFakeObserver<ResizeObserverEntry>();
    const size = createSize(fake.Ctor);

    expect(size.current).toEqual({ width: 0, height: 0 });
  });

  it("挂载后把 contentRect 写进 current", () => {
    const fake = createFakeObserver<ResizeObserverEntry>();
    const size = createSize(fake.Ctor);
    const el = document.createElement("div");

    size.attach(el);
    expect(fake.observed).toBe(el);

    fake.emit([entry(120, 40)]);
    expect(size.current).toEqual({ width: 120, height: 40 });
  });

  it("卸载后 observer 被 disconnect", () => {
    const fake = createFakeObserver<ResizeObserverEntry>();
    const size = createSize(fake.Ctor);

    const cleanup = size.attach(document.createElement("div"));
    cleanup();
    expect(fake.disconnected).toBe(true);
  });

  it("同一批多条记录取最后一条", () => {
    const fake = createFakeObserver<ResizeObserverEntry>();
    const size = createSize(fake.Ctor);

    size.attach(document.createElement("div"));
    fake.emit([entry(10, 10), entry(30, 50)]);
    expect(size.current).toEqual({ width: 30, height: 50 });
  });

  it("运行时不支持观察者时不抛错", () => {
    const size = createSize(undefined);
    const cleanup = size.attach(document.createElement("div"));

    expect(() => cleanup()).not.toThrow();
    expect(size.current).toEqual({ width: 0, height: 0 });
  });
});

describe("createVisibility", () => {
  const visibleEntry = (isIntersecting: boolean) =>
    ({ isIntersecting }) as unknown as IntersectionObserverEntry;

  it("默认不可见, 相交后变 true", () => {
    const fake = createFakeObserver<IntersectionObserverEntry>();
    const visibility = createVisibility(fake.Ctor);

    expect(visibility.visible).toBe(false);

    visibility.attach(document.createElement("div"));
    fake.emit([visibleEntry(true)]);
    expect(visibility.visible).toBe(true);

    fake.emit([visibleEntry(false)]);
    expect(visibility.visible).toBe(false);
  });

  it("卸载后 observer 被 disconnect", () => {
    const fake = createFakeObserver<IntersectionObserverEntry>();
    const visibility = createVisibility(fake.Ctor);

    const cleanup = visibility.attach(document.createElement("div"));
    cleanup();
    expect(fake.disconnected).toBe(true);
  });

  it("空批次不改变当前值", () => {
    const fake = createFakeObserver<IntersectionObserverEntry>();
    const visibility = createVisibility(fake.Ctor);

    visibility.attach(document.createElement("div"));
    fake.emit([]);
    expect(visibility.visible).toBe(false);
  });
});

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
    observerAttachment(fake.Ctor, (entries) => {
      seen.push(entries);
    })(document.createElement("div"));

    const batch = [entry(1, 1), entry(2, 2)];
    fake.emit(batch);
    expect(seen).toEqual([batch]);
  });
});
