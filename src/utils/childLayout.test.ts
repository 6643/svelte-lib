import { describe, expect, it } from "vite-plus/test";
import { CHILD_LIMIT, toChildPosVars, toChildVars, toVarsStyle } from "./childLayout.ts";

describe("toChildVars", () => {
  it("按下标生成 --child-N-suffix, 1 起编号", () => {
    expect(toChildVars([{ suffix: "grow", values: [1, 2] }])).toEqual({
      "--child-1-grow": "1",
      "--child-2-grow": "2",
    });
  });

  it("undefined 项跳过", () => {
    expect(toChildVars([{ suffix: "grow", values: [undefined, 2] }])).toEqual({
      "--child-2-grow": "2",
    });
  });

  it("未给数组的组不产生变量", () => {
    expect(toChildVars([{ suffix: "grow", values: undefined }])).toEqual({});
  });

  it("多组变量互不覆盖", () => {
    expect(
      toChildVars([
        { suffix: "grow", values: [1] },
        { suffix: "as", values: ["center"] },
      ]),
    ).toEqual({ "--child-1-grow": "1", "--child-1-as": "center" });
  });

  it("超过 CHILD_LIMIT 的项被截断", () => {
    const values = Array.from({ length: CHILD_LIMIT + 5 }, (_, index) => index + 1);
    const vars = toChildVars([{ suffix: "grow", values }]);

    expect(Object.keys(vars)).toHaveLength(CHILD_LIMIT);
    expect(vars[`--child-${CHILD_LIMIT}-grow`]).toBe(String(CHILD_LIMIT));
    expect(vars[`--child-${CHILD_LIMIT + 1}-grow`]).toBeUndefined();
  });

  it("字符串值原样输出", () => {
    expect(toChildVars([{ suffix: "as", values: ["flex-end"] }])).toEqual({
      "--child-1-as": "flex-end",
    });
  });
});

describe("toChildPosVars", () => {
  it("x 正数写 left, 负数写 right 且取绝对值", () => {
    expect(toChildPosVars([{ x: 10 }, { x: -8 }])).toEqual({
      "--child-1-left": "10",
      "--child-2-right": "8",
    });
  });

  it("y 正数写 top, 负数写 bottom 且取绝对值", () => {
    expect(toChildPosVars([{ y: 6 }, { y: -4 }])).toEqual({
      "--child-1-top": "6",
      "--child-2-bottom": "4",
    });
  });

  it("x/y 为 0 或未给时不产生该方向的变量", () => {
    expect(toChildPosVars([{ x: 0, y: 0 }])).toEqual({});
    expect(toChildPosVars([{}])).toEqual({});
  });

  it("未给 pos 时返回空表", () => {
    expect(toChildPosVars(undefined)).toEqual({});
  });

  it("超过 CHILD_LIMIT 的项被截断", () => {
    const pos = Array.from({ length: CHILD_LIMIT + 3 }, () => ({ x: 1 }));
    expect(Object.keys(toChildPosVars(pos))).toHaveLength(CHILD_LIMIT);
  });
});

describe("toVarsStyle", () => {
  it("拼成内联样式片段", () => {
    expect(toVarsStyle({ "--a": "1", "--b": "2" })).toBe("--a: 1; --b: 2;");
  });

  it("空表给空串", () => {
    expect(toVarsStyle({})).toBe("");
  });
});
