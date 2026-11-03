import type { Snippet } from "svelte";

// 校验返回值: 同步/异步都允许, `undefined` 表示通过.
export type ValidateResult = string | undefined | Promise<string | undefined>;

export type Validate = (value: string) => ValidateResult;

// 输入控件形态, 与源实现 Input.tsx 的 10 个导出逐一对应.
export type InputMode =
  | "range"
  | "text"
  | "textarea"
  | "password"
  | "number"
  | "email"
  | "tel"
  | "checkbox"
  | "radio"
  | "captcha";

// 三种双向绑定值, 由 mode 决定实际启用哪个:
// - value: range / text / textarea / password / number / email / tel / captcha (bind:value)
// - checked: checkbox (bind:checked)
// - group: radio 的选中值 (bind:group)
// 未绑定时组件内部持有值, 仍可正常交互.
export type InputBindings = {
  value?: string | number;
  checked?: boolean;
  group?: string;
};

// 字符串类字段的公共参数 (text / password / email / tel).
type StringFieldProps = InputBindings & {
  mode: "text" | "password" | "email" | "tel";
  label: string;
  value?: string;
  readonly?: boolean;
  minLen?: number;
  maxLen?: number;
  left?: Snippet;
  right?: Snippet;
  validate?: Validate;
};

export type RangeInputProps = InputBindings & {
  mode: "range";
  label: string;
  value?: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  left?: Snippet;
  right?: Snippet;
};

export type TextInputProps = StringFieldProps & { mode: "text" };

export type PasswordInputProps = StringFieldProps & { mode: "password" };

// 未给 validate 时用内置邮箱格式校验.
export type EmailInputProps = StringFieldProps & { mode: "email" };

export type TelInputProps = StringFieldProps & { mode: "tel"; pattern?: string };

export type TextAreaInputProps = InputBindings & {
  mode: "textarea";
  label: string;
  value?: string;
  readonly?: boolean;
  minLen?: number;
  maxLen?: number;
  validate?: Validate;
  // 行数, 缺省 5
  row?: number;
};

export type NumberInputProps = InputBindings & {
  mode: "number";
  label: string;
  value?: number;
  readonly?: boolean;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  left?: Snippet;
  right?: Snippet;
  validate?: Validate;
};

export type CheckInputProps = InputBindings & {
  mode: "checkbox";
  label: string;
  checked?: boolean;
  disabled?: boolean;
};

export type RadioInputProps = InputBindings & {
  mode: "radio";
  label: string;
  // 本选项的值; 与 group 相等即选中
  value: string;
  group?: string;
  disabled?: boolean;
  name?: string;
};

export type CaptchaInputProps = InputBindings & {
  mode: "captcha";
  label: string;
  value?: string;
  length?: number;
  disabled?: boolean;
  pattern?: RegExp;
};

// 合并源实现 RangeInput/TextInput/TextArea/PasswordInput/NumberInput/EmailInput/
// TelInput/CheckButton/RadioButton/CaptchaInput 后的单一契约.
// 源 Input.tsx 里它们本来就共用一个内部 Input 包装与同一套 useField 校验.
export type InputProps =
  | RangeInputProps
  | TextInputProps
  | PasswordInputProps
  | EmailInputProps
  | TelInputProps
  | TextAreaInputProps
  | NumberInputProps
  | CheckInputProps
  | RadioInputProps
  | CaptchaInputProps;
