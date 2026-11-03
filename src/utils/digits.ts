// 十进制数字序列, 供 `DigitWheel` 的 `values` 使用.
//
// `src/Counter.svelte` 与 `src/CountDown.svelte` 各写过一份, 取值与顺序完全一致;
// 抽到 utils 后它们是同一份数据, 不会因为改动其中一处而视觉分叉.
//
// 注意是可变数组 (与源实现一致): `DigitWheel` 只读, 但调用方可以按需 `slice()` 出子集.
export const DIGITS: number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
