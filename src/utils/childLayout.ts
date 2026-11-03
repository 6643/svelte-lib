// 逐子元素的布局微调: 把数组 props 转成根元素上的 CSS 变量,
// 子元素由 CSS 的 `:nth-child(n)` 读取, 不再用 `$effect` 逐个写内联样式.
//
// 上限 `CHILD_LIMIT`: CSS 的 `:nth-child` 规则是静态的, 因此能覆盖的子元素数
// 必须有界. 超过上限的子元素拿不到微调值 (退回组件自身的 CSS 默认值), 这是
// 从"effect 扫描全部子节点"换成"声明式变量"的代价, 文档里已注明.
export const CHILD_LIMIT = 12;

export type ChildVarGroup = {
  // 变量名后缀: `grow` -> `--child-1-grow`
  suffix: string;
  // 逐子元素的值; 越界项与 `undefined` 项跳过
  values?: (number | string | undefined)[];
};

// 生成 `--child-{n}-{suffix}` 一组变量.
export const toChildVars = (groups: ChildVarGroup[]): Record<string, string> => {
  const vars: Record<string, string> = {};

  for (const { suffix, values } of groups) {
    if (!values) continue;

    const limit = Math.min(values.length, CHILD_LIMIT);
    for (let index = 0; index < limit; index += 1) {
      const value = values[index];
      if (value === undefined) continue;
      vars[`--child-${index + 1}-${suffix}`] = String(value);
    }
  }

  return vars;
};

// 变量表转成内联 `style` 文本片段 (形如 `--a: 1; --b: 2;`).
export const toVarsStyle = (vars: Record<string, string>): string =>
  Object.entries(vars)
    .map(([name, value]) => `${name}: ${value};`)
    .join(" ");

export type ChildPos = { x?: number; y?: number };

// `StackBox` 的定位: x 正数靠左, 负数贴右侧; y 正数贴顶, 负数贴底部.
// 0 与未给都表示"不设该方向", 由 CSS 的默认定位接管.
export const toChildPosVars = (pos?: ChildPos[]): Record<string, string> => {
  const vars: Record<string, string> = {};
  if (!pos) return vars;

  const limit = Math.min(pos.length, CHILD_LIMIT);
  for (let index = 0; index < limit; index += 1) {
    const point = pos[index];
    if (!point) continue;

    const prefix = `--child-${index + 1}`;
    if (point.x) vars[`${prefix}-${point.x < 0 ? "right" : "left"}`] = String(Math.abs(point.x));
    if (point.y) vars[`${prefix}-${point.y < 0 ? "bottom" : "top"}`] = String(Math.abs(point.y));
  }

  return vars;
};
