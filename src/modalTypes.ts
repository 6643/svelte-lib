import type { Snippet } from "svelte";

// 弹层滑入方向: bottom 底部 / top 屏幕居中 / left 左侧 / right 右侧
export type ModalMode = "bottom" | "top" | "left" | "right";

// 合并源实现 BottomModal/TopModal/LeftModal/RightModal 后的单一契约.
// 四个源组件只有 modeClass/contentClass 不同, 这里统一成 mode 参数.
export type ModalProps = {
  // 滑入方向
  mode: ModalMode;
  // 显示/隐藏 (`bind:open`); 收起有 256ms 动画, 期间元素仍在 DOM
  open: boolean;
  onClose?: () => void;
  // 内容区宽度上限, 缺省 320px (left/right) 或内容自适应 (bottom)
  width?: string;
  // 内容区高度上限, 缺省 100vh
  height?: string;
  // 图标型弹层需要可访问名
  ariaLabel?: string;
  className?: string;
  children?: Snippet;
};
