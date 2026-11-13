/** 날짜 입력과 URL을 같은 범위·실제 달력 날짜로 검증한다. */
export const isCalendarDate = (value: string): boolean => {
  if (!/^(19\d{2}|20\d{2}|2100)-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
};

/** UTC 변환으로 날짜가 전날이 되지 않도록 브라우저 현지 날짜를 사용한다. */
export const todayDate = (): string => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
};

export const seoulDate = (): string => new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date());

export const normalizePopupPath = (value: string): string | undefined => {
  const path = value.trim();
  if (path.length > 300 || !/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]*$/.test(path)) return undefined;
  return path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
};
