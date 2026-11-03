// `GridBox` 的 `areas` 字符串 (`"a,b;c,d"`) 转成 CSS `grid-template-areas` 的值.
//
// 每条 `;` 分隔的行里取逗号前后两段, 各加 `_` 前缀; 空格一律忽略;
// 不足两段的行丢弃 (与源实现一致, 因此 `"a,b;c"` 只保留第一行).
export const toGridAreas = (value: string): string =>
  value
    .replace(/ /g, "")
    .split(";")
    .map((part) => {
      const [first, second] = part.split(",");
      if (first === undefined || second === undefined) return "";
      return `"_${first} _${second}"`;
    })
    .filter((part) => part !== "")
    .join(" ");

// 子元素的 `grid-area` 名: 纯数字按序号加 `_` 前缀 (`1` -> `_1`), 其它原样返回.
// 与 `toGridAreas` 的命名约定配套.
export const toGridAreaName = (index: string): string =>
  /^\d+$/.test(index) ? `_${index}` : index;
