// 中国时区时间戳, 形如 `YY-MM-DD HH:mm:ss`.
const formatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Shanghai",
  year: "2-digit",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

// 中国时区时间戳.
// `Intl.DateTimeFormat` 构造开销远高于一次格式化, 因此模块级只建一份 (纯函数, 无状态).
export const getChinaTimestamp = (): string => {
  const parts = Object.fromEntries(
    formatter.formatToParts(new Date()).map((part) => [part.type, part.value]),
  );

  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
};
