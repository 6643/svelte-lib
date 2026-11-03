// 验证码输入的最小事件表面: 只要 `inputType` 与 `data`, 便于纯函数单测.
export type CaptchaInputEvent = {
  inputType: string;
  data: string | null;
};

export type CaptchaRules = {
  // 允许的字符; 缺省 `\w` (与源实现一致)
  matcher: RegExp;
  // 最多保留几位
  limit: number;
};

export type CaptchaInputContext = CaptchaRules & {
  // 当前已接受的值 (组件持有的绑定值)
  current: string;
  // 输入框里的原始文本, 粘贴时用它
  text: string;
  event: CaptchaInputEvent;
};

export type CaptchaInputResult = {
  // 应该写回输入框与绑定值的文本
  value: string;
  // 绑定值是否真的变了; false 表示这次输入被丢弃
  changed: boolean;
};

// 源实现的默认字符集: 字母, 数字, 下划线.
export const DEFAULT_CAPTCHA_MATCHER = /^\w$/;

// 从任意文本里筛出匹配字符, 截断到 limit.
export const filterCaptchaText = (text: string, { matcher, limit }: CaptchaRules): string => {
  let result = "";
  // 逐码点遍历 (for...of), 不把代理对切成两半
  for (const char of text) {
    if (result.length >= limit) break;
    if (matcher.test(char)) result += char;
  }
  return result;
};

// 验证码输入的唯一决策点: 给定当前值与这次输入, 算出新的值.
//
// 只认三种输入:
// - `deleteContentBackward` 退一位
// - `insertText` 追加一个匹配字符, 满了就丢弃
// - `insertFromPaste` 整段过滤后替换
//
// 其余输入类型一律丢弃 (`changed: false`), 调用方据此把输入框恢复成当前值.
export const applyCaptchaInput = ({
  current,
  text,
  event,
  matcher,
  limit,
}: CaptchaInputContext): CaptchaInputResult => {
  const unchanged = { value: current, changed: false };

  if (event.inputType === "deleteContentBackward") {
    return { value: current.slice(0, -1), changed: true };
  }

  if (event.inputType === "insertText") {
    if (current.length >= limit) return unchanged;
    if (!event.data) return unchanged;

    let accepted: string | undefined;
    for (const char of event.data) {
      if (matcher.test(char)) {
        accepted = char;
        break;
      }
    }
    if (!accepted) return unchanged;

    return { value: current + accepted, changed: true };
  }

  if (event.inputType === "insertFromPaste") {
    const next = filterCaptchaText(text, { matcher, limit });
    return next === current ? unchanged : { value: next, changed: true };
  }

  return unchanged;
};
