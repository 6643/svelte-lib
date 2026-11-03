// Tab 外观, 与源实现的 BottomTab/TopTab/LeftTab/MenuTab/NavTab 逐一对应.
export type TabMode = "bottom" | "top" | "left" | "menu" | "nav";

// 面板切换动画方向: 横排左右, 竖排上下.
export type TabDirection = "left" | "right" | "up" | "down";

export type TabItem = {
  name?: string;
  icon?: string;
};
