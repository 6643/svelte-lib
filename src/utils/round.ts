// 把补间出的浮点数收尾到三位小数, 用于写进 CSS 变量.
//
// 不收敛的话 `--index` 这类变量会带上十几位小数, 既让 DOM 快照难以比对,
// 也让 `style` 属性每帧都变长. 三位小数对百分比/像素位移远远够用.
export const roundCss = (value: number): number => Math.round(value * 1000) / 1000;
