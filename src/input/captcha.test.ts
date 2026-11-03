import { describe, expect, it } from "vite-plus/test";
import { applyCaptchaInput, filterCaptchaText } from "./captcha.ts";

const rules = { matcher: /^\w$/, limit: 3 };

const type = (current: string, data: string | null) =>
  applyCaptchaInput({
    current,
    text: current,
    event: { inputType: "insertText", data },
    ...rules,
  });

describe("filterCaptchaText", () => {
  it("只留匹配字符并截断", () => {
    expect(filterCaptchaText("a1-b2c3d4", rules)).toBe("a1b");
  });

  it("大小写与下划线按 \\w 保留", () => {
    expect(filterCaptchaText("A_z9!", { matcher: /^\w$/, limit: 10 })).toBe("A_z9");
  });

  it("自定义 matcher 生效", () => {
    expect(filterCaptchaText("12ab34", { matcher: /^\d$/, limit: 10 })).toBe("1234");
  });
});

describe("applyCaptchaInput", () => {
  it("insertText 追加匹配字符", () => {
    expect(type("a", "b")).toEqual({ value: "ab", changed: true });
  });

  it("达到 limit 后丢弃", () => {
    expect(type("abc", "d")).toEqual({ value: "abc", changed: false });
  });

  it("非匹配字符丢弃", () => {
    expect(type("a", "-")).toEqual({ value: "a", changed: false });
  });

  it("data 为空丢弃", () => {
    expect(type("a", null)).toEqual({ value: "a", changed: false });
  });

  it("deleteContentBackward 退一位", () => {
    expect(
      applyCaptchaInput({
        current: "abc",
        text: "abc",
        event: { inputType: "deleteContentBackward", data: null },
        ...rules,
      }),
    ).toEqual({ value: "ab", changed: true });
  });

  it("insertFromPaste 整段过滤后替换", () => {
    expect(
      applyCaptchaInput({
        current: "a1",
        text: "a1-b2c3d4",
        event: { inputType: "insertFromPaste", data: null },
        ...rules,
      }),
    ).toEqual({ value: "a1b", changed: true });
  });

  it("粘贴内容与当前值相同视为未变化", () => {
    expect(
      applyCaptchaInput({
        current: "a1b",
        text: "a1b",
        event: { inputType: "insertFromPaste", data: null },
        ...rules,
      }),
    ).toEqual({ value: "a1b", changed: false });
  });

  it("其它输入类型一律丢弃", () => {
    expect(
      applyCaptchaInput({
        current: "ab",
        text: "abX",
        event: { inputType: "insertCompositionText", data: "X" },
        ...rules,
      }),
    ).toEqual({ value: "ab", changed: false });
  });
});
