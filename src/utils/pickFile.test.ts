import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { pickFile } from "./pickFile.ts";

// 用桩替掉 input.click, 拿到创建出来的 input 元素以便手动触发事件.
const stubClick = () => {
  const created: HTMLInputElement[] = [];
  const proto = HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(proto, "click");

  Object.defineProperty(proto, "click", {
    configurable: true,
    writable: true,
    value(this: HTMLInputElement) {
      created.push(this);
    },
  });

  return {
    last: () => created[created.length - 1] as HTMLInputElement,
    restore: () => {
      if (descriptor) Object.defineProperty(proto, "click", descriptor);
      else delete (proto as unknown as Record<string, unknown>).click;
    },
  };
};

const setFiles = (input: HTMLInputElement, files: File[]) => {
  Object.defineProperty(input, "files", { value: files, configurable: true });
};

afterEach(() => {
  vi.useRealTimers();
});

describe("pickFile", () => {
  it("change 带文件时 resolve 文件列表", async () => {
    const click = stubClick();
    const pending = pickFile("image/*");

    const input = click.last();
    expect(input.accept).toBe("image/*");
    expect(input.multiple).toBe(false);

    const files = [new File(["a"], "a.png")];
    setFiles(input, files);
    input.dispatchEvent(new Event("change"));

    await expect(pending).resolves.toBe(files);
    click.restore();
  });

  it("change 无文件时 resolve null", async () => {
    const click = stubClick();
    const pending = pickFile();

    const input = click.last();
    setFiles(input, []);
    input.dispatchEvent(new Event("change"));

    await expect(pending).resolves.toBeNull();
    click.restore();
  });

  it("只收到 focus 时, 300ms 后 resolve null", async () => {
    vi.useFakeTimers();
    const click = stubClick();
    const pending = pickFile();

    window.dispatchEvent(new Event("focus"));
    await vi.advanceTimersByTimeAsync(300);

    await expect(pending).resolves.toBeNull();
    click.restore();
  });

  it("change 先到时, 之后的 focus 不再把它改成 null", async () => {
    vi.useFakeTimers();
    const click = stubClick();
    const pending = pickFile();

    const files = [new File(["a"], "a.png")];
    setFiles(click.last(), files);
    click.last().dispatchEvent(new Event("change"));

    // change 已经结算, 用户回到页面触发的 focus 不应覆盖结果
    window.dispatchEvent(new Event("focus"));
    await vi.advanceTimersByTimeAsync(300);

    await expect(pending).resolves.toBe(files);
    click.restore();
  });

  it("多次 focus 只结算一次", async () => {
    vi.useFakeTimers();
    const click = stubClick();
    const pending = pickFile();

    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("focus"));
    await vi.advanceTimersByTimeAsync(300);

    await expect(pending).resolves.toBeNull();
    click.restore();
  });
});
