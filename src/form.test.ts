import { render, fireEvent } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vite-plus/test";
import Input from "./Input.svelte";
import ControlledField from "../test/fixtures/ControlledField.svelte";

const fill = async (input: HTMLInputElement | HTMLTextAreaElement, value: string) => {
  await fireEvent.input(input, { target: { value } });
};

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

// 合并后所有形态都走 <Input mode=...>; 下面按 mode 分组, 断言与原 10 个组件一一对应.
describe("Input mode=text", () => {
  it("输入回写到绑定值, 值同步到 input.value", async () => {
    const { container } = render(ControlledField, { props: { component: "text", label: "名字" } });
    const input = container.querySelector("input") as HTMLInputElement;

    await fill(input, "abc");
    expect(container.querySelector(".value")?.textContent).toBe("abc");
    expect(input.value).toBe("abc");
  });

  it("label 与 input-wrap / field-error 结构就位", () => {
    const { container } = render(Input, { props: { mode: "text", label: "名字" } });

    expect(container.querySelector(".input-wrap")).not.toBeNull();
    expect(container.querySelector(".field-error")).not.toBeNull();
    expect(container.querySelector("label")?.textContent).toContain("名字");
  });

  it("inputmode 为 text, type 为 text", () => {
    const { container } = render(Input, { props: { mode: "text", label: "名字" } });
    const input = container.querySelector("input") as HTMLInputElement;

    expect(input.type).toBe("text");
    expect(input.getAttribute("inputmode")).toBe("text");
  });

  it("validate 返回字符串时渲染错误文案并加 error 类", async () => {
    const validate = (value: string) => (value.length < 3 ? "太短" : undefined);
    const { container } = render(ControlledField, {
      props: { component: "text", label: "名字", validate },
    });
    const input = container.querySelector("input") as HTMLInputElement;

    await fill(input, "ab");
    await flush();
    expect(container.querySelector(".field-error")?.textContent).toContain("太短");
    expect(container.querySelector(".field")?.classList.contains("error")).toBe(true);

    await fill(input, "abc");
    await flush();
    expect(container.querySelector(".field-error")?.textContent?.trim()).toBe("");
    expect(container.querySelector(".field")?.classList.contains("error")).toBe(false);
  });

  it("validate 返回 Promise 时先显示校验中, resolve 后替换", async () => {
    let resolveValidate: (msg: string | undefined) => void = () => {};
    const validate = () =>
      new Promise<string | undefined>((resolve) => {
        resolveValidate = resolve;
      });
    const { container } = render(ControlledField, {
      props: { component: "text", label: "名字", validate },
    });

    await fill(container.querySelector("input") as HTMLInputElement, "a");
    expect(container.querySelector(".field-error")?.textContent).toContain("校验中");

    resolveValidate("冲突");
    await flush();
    expect(container.querySelector(".field-error")?.textContent).toContain("冲突");
  });

  it("异步校验慢的结果不覆盖新结果", async () => {
    const pending: ((msg: string | undefined) => void)[] = [];
    const validate = () =>
      new Promise<string | undefined>((resolve) => {
        pending.push(resolve);
      });
    const { container } = render(ControlledField, {
      props: { component: "text", label: "名字", validate },
    });
    const input = container.querySelector("input") as HTMLInputElement;

    await fill(input, "a");
    await fill(input, "ab");
    // 首次渲染也会跑一次校验, 因此至少有 3 次请求
    expect(pending.length).toBeGreaterThanOrEqual(3);

    pending[pending.length - 1]("新结果");
    await flush();
    pending[pending.length - 2]("旧结果");
    await flush();
    expect(container.querySelector(".field-error")?.textContent).toContain("新结果");
  });
});

describe("Input mode=textarea", () => {
  it("rows 缺省 5, 可覆盖", () => {
    const fallback = render(Input, { props: { mode: "textarea", label: "备注" } });
    expect(
      (fallback.container.querySelector("textarea") as HTMLTextAreaElement).getAttribute("rows"),
    ).toBe("5");

    const custom = render(Input, { props: { mode: "textarea", label: "备注", row: 3 } });
    expect(
      (custom.container.querySelector("textarea") as HTMLTextAreaElement).getAttribute("rows"),
    ).toBe("3");
  });

  it("带 plain-textarea 类并可编辑", async () => {
    const { container } = render(ControlledField, {
      props: { component: "textarea", label: "备注" },
    });
    const area = container.querySelector("textarea") as HTMLTextAreaElement;

    expect(area.classList.contains("plain-textarea")).toBe(true);
    expect(area.readOnly).toBe(false);

    await fill(area, "多行");
    expect(container.querySelector(".value")?.textContent).toBe("多行");
    expect(area.value).toBe("多行");
  });
});

describe("Input mode=password", () => {
  it("type 为 password", () => {
    const { container } = render(Input, { props: { mode: "password", label: "密码" } });

    expect((container.querySelector("input") as HTMLInputElement).type).toBe("password");
  });
});

describe("Input mode=number", () => {
  it("点 + / - 按 step 变化并在 min/max 夹紧", async () => {
    const { container } = render(ControlledField, {
      props: { component: "number", label: "数量", initial: "2", min: 1, max: 3 },
    });
    const [decrement, increment] = Array.from(
      container.querySelectorAll(".input-wrap button"),
    ) as HTMLButtonElement[];

    await fireEvent.click(increment);
    expect(container.querySelector(".value")?.textContent).toBe("3");

    // 已达 max, 再点仍是 3
    await fireEvent.click(increment);
    expect(container.querySelector(".value")?.textContent).toBe("3");
    expect((container.querySelector("input") as HTMLInputElement).value).toBe("3");

    await fireEvent.click(decrement);
    expect(container.querySelector(".value")?.textContent).toBe("2");
  });

  it("readonly 时按钮不改变值", async () => {
    const { container } = render(Input, {
      props: { mode: "number", label: "数量", value: 2, readonly: true },
    });
    const input = container.querySelector("input") as HTMLInputElement;
    const increment = container.querySelectorAll(".input-wrap button")[1] as HTMLButtonElement;

    await fireEvent.click(increment);
    expect(input.value).toBe("2");
  });

  it("加减按钮带 aria-label", () => {
    const { container } = render(Input, {
      props: { mode: "number", label: "数量", value: 2 },
    });
    const labels = Array.from(container.querySelectorAll(".input-wrap button")).map((button) =>
      button.getAttribute("aria-label"),
    );

    expect(labels).toEqual(["Decrease", "Increase"]);
  });
});

describe("Input mode=range", () => {
  it("拖动回写绑定值并显示当前值和单位", async () => {
    const { container } = render(ControlledField, {
      props: { component: "range", label: "音量", initial: "10", min: 0, max: 100 },
    });

    const range = container.querySelector('input[type="range"]') as HTMLInputElement;
    expect(range.min).toBe("0");
    expect(range.max).toBe("100");
    expect(container.querySelector("[data-unit]")?.textContent).toContain("10");

    await fireEvent.input(range, { target: { value: "42" } });
    expect(container.querySelector(".value")?.textContent).toBe("42");
    expect(container.querySelector("[data-unit]")?.textContent).toContain("42");
  });

  it("没有 Field 外壳, 直接是 .range-input", () => {
    const { container } = render(Input, { props: { mode: "range", label: "音量" } });

    expect(container.querySelector(".range-input")).not.toBeNull();
    expect(container.querySelector(".field")).toBeNull();
  });
});

describe("Input mode=email / tel", () => {
  it("email 非法邮箱给默认错误文案", async () => {
    const { container } = render(ControlledField, {
      props: { component: "email", label: "邮箱" },
    });
    const input = container.querySelector("input") as HTMLInputElement;

    expect(input.type).toBe("email");
    await fill(input, "not-an-email");
    await flush();
    expect(container.querySelector(".field-error")?.textContent).toContain("邮箱格式不正确");

    await fill(input, "a@b.co");
    await flush();
    expect(container.querySelector(".field-error")?.textContent?.trim()).toBe("");
  });

  it("tel 透传 pattern", () => {
    const { container } = render(Input, {
      props: { mode: "tel", label: "电话", pattern: "[0-9]*" },
    });
    const input = container.querySelector("input") as HTMLInputElement;

    expect(input.type).toBe("tel");
    expect(input.getAttribute("pattern")).toBe("[0-9]*");
  });
});

describe("Input mode=checkbox", () => {
  it("勾选回写 bind:checked", async () => {
    const { container } = render(ControlledField, {
      props: { component: "checkbox", label: "同意" },
    });
    const input = container.querySelector("input") as HTMLInputElement;

    expect(input.type).toBe("checkbox");
    expect(input.checked).toBe(false);

    await fireEvent.click(input);
    expect(input.checked).toBe(true);
    expect(container.querySelector(".value")?.textContent?.trim()).toBe("true");
  });

  it("disabled 时不可勾选", () => {
    const { container } = render(Input, {
      props: { mode: "checkbox", label: "同意", disabled: true },
    });

    expect((container.querySelector("input") as HTMLInputElement).disabled).toBe(true);
  });

  it("宿主带 .check-btn 类", () => {
    const { container } = render(Input, { props: { mode: "checkbox", label: "同意" } });

    expect(container.querySelector("label.check-btn")).not.toBeNull();
  });
});

describe("Input mode=radio", () => {
  it("点击回写 bind:group", async () => {
    const { container } = render(ControlledField, {
      props: { component: "radio", label: "男" },
    });
    const input = container.querySelector("input") as HTMLInputElement;

    expect(input.type).toBe("radio");
    expect(input.getAttribute("name")).toBe("gender");

    await fireEvent.click(input);
    expect(input.checked).toBe(true);
    expect(container.querySelector(".value")?.textContent?.trim()).toBe("male");
  });

  it("宿主带 .radio-btn 类", () => {
    const { container } = render(Input, {
      props: { mode: "radio", label: "男", value: "male" },
    });

    expect(container.querySelector("label.radio-btn")).not.toBeNull();
  });
});

describe("Input mode=captcha", () => {
  it("输入非 pattern 字符被丢弃, 达到 length 后不再增长", async () => {
    const changed = vi.fn();
    const { container } = render(ControlledField, {
      props: { component: "captcha", label: "验证码", length: 3, onChanged: changed },
    });
    const input = container.querySelector("input") as HTMLInputElement;

    await fireEvent.input(input, { inputType: "insertText", data: "a" });
    expect(changed).toHaveBeenLastCalledWith("a");

    await fireEvent.input(input, { inputType: "insertText", data: "b" });
    expect(changed).toHaveBeenLastCalledWith("ab");

    await fireEvent.input(input, { inputType: "insertText", data: "c" });
    expect(changed).toHaveBeenLastCalledWith("abc");

    // 已到 length, 再输入被丢弃
    await fireEvent.input(input, { inputType: "insertText", data: "d" });
    expect(changed).toHaveBeenCalledTimes(3);

    // 非 pattern 字符同样被丢弃
    await fireEvent.input(input, { inputType: "insertText", data: "-" });
    expect(changed).toHaveBeenCalledTimes(3);
  });

  it("粘贴时过滤非匹配字符并截断到 length", async () => {
    const changed = vi.fn();
    const { container } = render(ControlledField, {
      props: {
        component: "captcha",
        label: "验证码",
        length: 6,
        onChanged: changed,
        initial: "a1",
      },
    });
    const input = container.querySelector("input") as HTMLInputElement;

    input.value = "a1-b2c3d4";
    await fireEvent.input(input, { inputType: "insertFromPaste", data: null });
    expect(changed).toHaveBeenLastCalledWith("a1b2c3");
  });

  it("右侧粘贴按钮读剪贴板", async () => {
    const writeText = vi.fn();
    Object.defineProperty(navigator, "clipboard", {
      value: { readText: () => Promise.resolve("x9y8z7w6"), writeText },
      configurable: true,
    });
    const changed = vi.fn();
    const { container } = render(ControlledField, {
      props: { component: "captcha", label: "验证码", length: 4, onChanged: changed },
    });

    await fireEvent.click(container.querySelector(".input-wrap button") as HTMLButtonElement);
    await flush();
    expect(changed).toHaveBeenLastCalledWith("x9y8");
  });

  it("len 写到 --len 变量", () => {
    const { container } = render(Input, {
      props: { mode: "captcha", label: "验证码", length: 4 },
    });
    const input = container.querySelector("input") as HTMLInputElement;

    expect(input.style.getPropertyValue("--len")).toBe("4");
    expect(input.getAttribute("maxlength")).toBe("4");
  });

  it("粘贴按钮带 aria-label", () => {
    const { container } = render(Input, { props: { mode: "captcha", label: "验证码" } });

    expect(container.querySelector(".input-wrap button")?.getAttribute("aria-label")).toBe(
      "Paste captcha",
    );
  });
});

describe("Field 异步校验竞态", () => {
  it("先发后至的结果被丢弃, 只显示最后一次", async () => {
    // 第一次校验慢, 第二次快: 序号/取消语义必须让第二次的结论生效
    const pending: Array<(message: string | undefined) => void> = [];
    const validate = () =>
      new Promise<string | undefined>((resolve) => {
        pending.push(resolve);
      });

    const { container } = render(ControlledField, {
      props: { component: "text", label: "名字", validate },
    });
    const input = container.querySelector("input") as HTMLInputElement;

    // 首帧 (空值) 也会校验一次, 因此只看最后两次
    await fill(input, "a");
    await flush();
    await fill(input, "ab");
    await flush();
    const [stale, latest] = pending.slice(-2);
    expect(pending.length).toBeGreaterThanOrEqual(2);

    // 最新一次先回 (通过), 更早的一次后回 (报错): 旧结论不能覆盖
    latest?.(undefined);
    await flush();
    stale?.("旧结论");
    await flush();

    expect(container.querySelector(".field-error")?.textContent?.trim()).toBe("");
    expect(container.querySelector(".field")?.classList.contains("error")).toBe(false);
  });
});
