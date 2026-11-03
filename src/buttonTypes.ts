import type { Snippet } from "svelte";

// 点击回调: 返回值被忽略, 但如果是 Promise 会在完成前禁用按钮.
export type ButtonClickHandler = (event: MouseEvent) => unknown;

// 按钮外观: icon 圆形图标 / text 文字 / filled 实心 / outlined 描边
export type ButtonMode = "icon" | "text" | "filled" | "outlined";

// 合并源实现 IconButton/TextButton/FilledButton/OutlinedButton 后的单一契约.
// 四个源组件只是同一个 BaseButton 传不同 mode class 与不同的 style 白名单.
export type ButtonProps = {
  // 外观
  mode: ButtonMode;
  // 点击回调 (Svelte 原生事件名)
  onclick?: ButtonClickHandler;
  disabled?: boolean;
  // 文字/图标颜色
  color?: string;
  // SVG path data (单条 path)
  icon?: string;
  // 文案; 有 children 时以 children 为准
  text?: string;
  // 仅 filled 生效: 背景色
  bgColor?: string;
  borderRadius?: number | string;
  width?: number | string;
  height?: number | string;
  // 可访问名称: 只有图标的按钮必须给
  ariaLabel?: string;
  // 展开态 (可选)。触发式按钮 (如调色板) 给出后渲染为 `aria-expanded`
  ariaExpanded?: boolean;
  // 弹出面板 id, 与面板的 id 对应时渲染 `aria-controls`
  ariaControls?: string;
  children?: Snippet;
};
