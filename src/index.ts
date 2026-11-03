import "./_.css";

// 图标: svgicons.ts 里每个图标都是具名导出, 与 solid 版一致
export { default as SvgIcon } from "./SvgIcon.svelte";
export * from "./svgicons.ts";

// Buttons
// 合并了源实现的 IconButton/TextButton/FilledButton/OutlinedButton: 一处 mode 参数
export { default as Button } from "./Button.svelte";
export type { ButtonMode, ButtonProps, ButtonClickHandler } from "./buttonTypes.ts";

// Input (表单控件; 与 solid 的 Input.tsx 家族对应)
// 合并了源实现的 RangeInput/TextInput/TextArea/PasswordInput/NumberInput/EmailInput/
// TelInput/CheckButton/RadioButton/CaptchaInput: 一处 mode 参数
export { default as Input } from "./Input.svelte";
export type {
  InputMode,
  InputProps,
  InputBindings,
  Validate,
  ValidateResult,
} from "./inputTypes.ts";

// Layout
export { default as Block } from "./Box.svelte";
export { default as Card } from "./Card.svelte";
export { default as CenterBox } from "./CenterBox.svelte";
export { default as FlexBox } from "./FlexBox.svelte";
export { default as GridBox } from "./GridBox.svelte";
export { default as StackBox } from "./StackBox.svelte";

// Interaction
// 合并了源实现的 BottomModal/TopModal/LeftModal/RightModal: 一处 mode 参数
export { default as Modal } from "./Modal.svelte";
export type { ModalMode, ModalProps } from "./modalTypes.ts";
export { default as Expand } from "./Expand.svelte";
export { default as Carousel } from "./Carousel.svelte";
// Tab (外观由 mode 决定: 合并了源实现的 BottomTab/TopTab/LeftTab/MenuTab/NavTab)
export { default as Tab } from "./Tab.svelte";

// Display
export { default as AvatarImage } from "./AvatarImage.svelte";
export { default as CountDown } from "./CountDown.svelte";
export { default as Counter } from "./Counter.svelte";
export { default as DigitWheel } from "./DigitWheel.svelte";
export { default as TimeLine } from "./TimeLine.svelte";
export { default as ImagePlayer } from "./ImagePlayer.svelte";
export { default as ListBox } from "./ListBox.svelte";
export { default as SortListBox } from "./SortListBox.svelte";

// Functional
export { default as CityPicker } from "./CityPicker.svelte";
export { initCities } from "./cities.svelte.ts";
export type { City } from "./cities.svelte.ts";
export { default as LoadMore } from "./LoadMore.svelte";
export { default as ThemeSwitch } from "./ThemeSwitch.svelte";
export { default as AccentSelector } from "./AccentSelector.svelte";
// 与 solid 一致的别名
export { default as ThemeToggle } from "./ThemeSwitch.svelte";
export { default as AccentPicker } from "./AccentSelector.svelte";

// Theme: 状态与 storage 都在同一个模块里, 只有一份真源
export {
  accent,
  getAccent,
  getResolvedThemeMode,
  getThemeMode,
  initAccent,
  initTheme,
  setAccent,
  setDarkTheme,
  setLightTheme,
  setSystemTheme,
  setThemeMode,
  theme,
} from "./theme.svelte.ts";
export type { ResolvedTheme, ThemeHandle, ThemeMode } from "./theme.svelte.ts";

// Form 基础设施 (solid 里它们是 Input.tsx 的内部实现, 这里导出以便自定义字段)
export { default as Field } from "./Field.svelte";

// Hooks & Utils
export { createDebounce } from "./utils/createDebounce.ts";
export type { DebouncedFunction } from "./utils/createDebounce.ts";
export { createThrottle } from "./utils/createThrottle.ts";
export { createOnce } from "./utils/createOnce.ts";
export { getChinaTimestamp } from "./utils/getChinaTimestamp.ts";
export { pickFile } from "./utils/pickFile.ts";
export { scaleImage } from "./utils/scaleImage.ts";
export type { ScaleImageOptions } from "./utils/scaleImage.ts";
export { createHttp, http } from "./utils/createHttp.ts";
export type { HttpOptions } from "./utils/createHttp.ts";

// 元素类 hook: 都是 attachment, 用法 `{@attach useXxx(...)}`
export { useClickOutside } from "./hooks/useClickOutside.ts";
export type { ClickOutsideOptions } from "./hooks/useClickOutside.ts";
export { useTap, useLongPress } from "./hooks/useGestures.ts";
export type { GestureOptions } from "./hooks/useGestures.ts";
export { useMutation } from "./hooks/useMutation.ts";
export { useResize } from "./hooks/useResize.ts";
export { useVis } from "./hooks/useVis.ts";
export { createSize } from "./hooks/createSize.svelte.ts";
export type { SizeHandle, Size } from "./hooks/createSize.svelte.ts";
export { createVisibility } from "./hooks/createVisibility.svelte.ts";
export type { VisibilityHandle } from "./hooks/createVisibility.svelte.ts";
export { useScrollEnd } from "./hooks/useScrollEnd.ts";
export { useKeepScroll, getPos, setPos, delPos } from "./hooks/useKeepScroll.ts";
export { useRefresh } from "./hooks/useRefresh.ts";
export { PullState, PULL_CLASS } from "./hooks/createPullRefresh.svelte.ts";
export { createPullRefresh } from "./hooks/createPullRefresh.svelte.ts";
export type { PullStateValue, PullRefreshHandle } from "./hooks/createPullRefresh.svelte.ts";

// 动画: 把 $state 目标补间成可读当前帧的 Tween (svelte/motion)
export { createTween } from "./hooks/createTween.svelte.ts";
export type { TweenOptions } from "./hooks/createTween.svelte.ts";

// 状态类 hook: 返回带 $state 字段的对象, 可直接 bind
export { createStorage } from "./hooks/createStorage.svelte.ts";
export type { StorageHandle } from "./hooks/createStorage.svelte.ts";
export { createCopy } from "./hooks/createCopy.svelte.ts";
export type { CopyHandle } from "./hooks/createCopy.svelte.ts";
export { createDebouncedSignal } from "./hooks/createDebouncedSignal.svelte.ts";
export type { DebouncedSignalHandle } from "./hooks/createDebouncedSignal.svelte.ts";
export { createFullscreen } from "./hooks/createFullscreen.svelte.ts";
export type { FullscreenHandle } from "./hooks/createFullscreen.svelte.ts";
export { createLoad } from "./hooks/createLoad.svelte.ts";
export { useLoadMore } from "./hooks/useLoadMore.ts";
export { createMediaQuery } from "./hooks/createMediaQuery.svelte.ts";
export type { MediaQueryHandle } from "./hooks/createMediaQuery.svelte.ts";
export type { LoadHandle, LoadMoreFn } from "./hooks/createLoad.svelte.ts";
export { useKeyPress } from "./hooks/useKeyPress.svelte.ts";
export { createCountdown } from "./hooks/createCountdown.svelte.ts";
export type { CountdownHandle } from "./hooks/createCountdown.svelte.ts";
export { createWakeLock } from "./hooks/createWakeLock.svelte.ts";
export type { WakeLockHandle } from "./hooks/createWakeLock.svelte.ts";
export { createTry } from "./hooks/createTry.svelte.ts";
export type { TryError } from "./hooks/createTry.svelte.ts";
// 差异: solid 的 createTry 返回带 TryCatch 字段的对象; 这里拆成 createTry + <TryCatch> 组件
export { default as TryCatch } from "./TryCatch.svelte";

export type { TabItem, TabMode, TabDirection } from "./tabTypes.ts";

// Route 子路径 (与 solid 的 `solid-lib/route` 对齐), 也在此处一并导出便于直接使用
export { default as Route } from "./Route.svelte";
export * from "./route.svelte.ts";
