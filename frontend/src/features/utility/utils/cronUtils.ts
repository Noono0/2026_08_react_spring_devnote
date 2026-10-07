/**
 * cronUtils.ts — Cron 표현식(예약 실행 시간표) 만들기·설명·다음 실행 시각 계산
 *
 * 두 방언을 지원한다.
 *   SPRING : 초 분 시 일 월 요일 (6칸) — @Scheduled(cron = "0 0 9 * * ?"). 일·요일 중 하나는 ?(지정 안 함)를 쓸 수 있다.
 *   LINUX  : 분 시 일 월 요일 (5칸) — crontab
 * 각 칸에 쓸 수 있는 모양: 숫자(5), 별표 *(매번), 별표+슬래시+숫자(15분마다 = 별표 슬래시 15), 범위(1-5), 목록(1,3,5)
 */

export type CronDialect = "SPRING" | "LINUX";

export interface CronFields {
  second: string;
  minute: string;
  hour: string;
  dayOfMonth: string;
  month: string;
  dayOfWeek: string;
}

/** 칸 하나를 검사한다. 허용된 모양이 아니거나 범위를 벗어나면 어느 칸이 왜 틀렸는지 알려 주는 오류를 던진다. */
const validateField = (label: string, rawValue: string, minimum: number, maximum: number, allowQuestion = false): string => {
  const value = rawValue.trim();
  if (value === "*" || (allowQuestion && value === "?")) return value;
  if (value === "?" && !allowQuestion) throw new Error(`${label} 필드에는 ?를 사용할 수 없습니다.`);

  const assertInRange = (numberValue: number): void => {
    if (!Number.isInteger(numberValue) || numberValue < minimum || numberValue > maximum) throw new Error(`${label} 값은 ${minimum}~${maximum} 범위여야 합니다.`);
  };
  if (/^\*\/\d+$/.test(value)) {
    const step = Number(value.slice(2));
    if (step < 1 || step > maximum - minimum + 1) throw new Error(`${label} 간격은 1~${maximum - minimum + 1} 범위여야 합니다.`);
    return value;
  }
  if (/^\d+(?:,\d+)+$/.test(value)) {
    value.split(",").map(Number).forEach(assertInRange);
    return value;
  }
  if (/^\d+-\d+$/.test(value)) {
    const [start, end] = value.split("-").map(Number);
    assertInRange(start ?? Number.NaN);
    assertInRange(end ?? Number.NaN);
    if ((start ?? 0) > (end ?? 0)) throw new Error(`${label} 범위의 시작값은 끝값보다 클 수 없습니다.`);
    return value;
  }
  if (/^\d+$/.test(value)) {
    assertInRange(Number(value));
    return value;
  }
  throw new Error(`${label} 필드는 숫자, *, ${allowQuestion ? "?, " : ""}*/간격, 범위, 쉼표 목록만 사용할 수 있습니다.`);
};

/** 칸들을 검사한 뒤 방언에 맞는 순서로 공백으로 이어 붙여 표현식을 만든다. */
export const buildCronExpression = (dialect: CronDialect, fields: CronFields): string => {
  const second = dialect === "SPRING" ? validateField("초", fields.second, 0, 59) : "";
  const minute = validateField("분", fields.minute, 0, 59);
  const hour = validateField("시", fields.hour, 0, 23);
  const dayOfMonth = validateField("일", fields.dayOfMonth, 1, 31, dialect === "SPRING");
  const month = validateField("월", fields.month, 1, 12);
  const dayOfWeek = validateField("요일", fields.dayOfWeek, 0, 6, dialect === "SPRING");
  return (dialect === "SPRING" ? [second, minute, hour, dayOfMonth, month, dayOfWeek] : [minute, hour, dayOfMonth, month, dayOfWeek]).join(" ");
};

const describeField = (value: string, unit: string): string => {
  if (value === "*") return `매 ${unit}`;
  if (value === "?") return `${unit} 미지정`;
  if (value.startsWith("*/")) return `${value.slice(2)}${unit} 간격`;
  if (value.includes(",")) return `${value}${unit}`;
  if (value.includes("-")) return `${value}${unit} 범위`;
  return `${value}${unit}`;
};

/** 사람이 읽는 설명("매 분, 9시, … 에 실행합니다.")을 만든다. */
export const describeCron = (dialect: CronDialect, fields: CronFields): string => {
  const parts = [describeField(fields.minute, "분"), describeField(fields.hour, "시"), describeField(fields.dayOfMonth, "일"), describeField(fields.month, "월"), describeField(fields.dayOfWeek, "요일")];
  if (dialect === "SPRING") parts.unshift(describeField(fields.second, "초"));
  return `${parts.join(", ")}에 실행합니다.`;
};

/** 현재 값(예: 지금 몇 분)이 칸의 조건에 맞는지. */
const fieldMatches = (value: string, current: number): boolean => {
  if (value === "*" || value === "?") return true;
  if (value.startsWith("*/")) return current % Number(value.slice(2)) === 0;
  if (value.includes(",")) return value.split(",").some((item) => Number(item) === current);
  if (value.includes("-")) {
    const [start, end] = value.split("-").map(Number);
    return current >= (start ?? 0) && current <= (end ?? 0);
  }
  return Number(value) === current;
};

/**
 * 다음 실행 시각 count개를 찾는다. 시작 시각부터 1초(또는 1분)씩 앞으로 가며 모든 칸이 맞는 순간을 모은다.
 * 무한 반복을 막기 위해 최대 탐색 범위를 둔다(분 단위면 약 370일, 초 단위면 14일).
 * LINUX이거나 SPRING의 초가 고정 숫자면 1분씩 건너뛰어 계산량을 60분의 1로 줄인다.
 */
export const nextCronRuns = (dialect: CronDialect, fields: CronFields, startDate = new Date(), count = 5): Date[] => {
  const results: Date[] = [];
  const cursor = new Date(startDate);
  cursor.setMilliseconds(0);
  const springHasFixedSecond = dialect === "SPRING" && /^\d+$/.test(fields.second);
  if (dialect === "LINUX") {
    cursor.setSeconds(0);
    cursor.setMinutes(cursor.getMinutes() + 1);
  } else if (springHasFixedSecond) {
    const fixedSecond = Number(fields.second);
    if (cursor.getSeconds() >= fixedSecond) cursor.setMinutes(cursor.getMinutes() + 1);
    cursor.setSeconds(fixedSecond);
  } else {
    cursor.setSeconds(cursor.getSeconds() + 1);
  }
  const useMinuteStep = dialect === "LINUX" || springHasFixedSecond;
  const maximumIterations = useMinuteStep ? 370 * 24 * 60 : 14 * 24 * 60 * 60;
  const stepMilliseconds = useMinuteStep ? 60_000 : 1_000;
  for (let iteration = 0; iteration < maximumIterations && results.length < count; iteration += 1) {
    if ((dialect === "LINUX" || fieldMatches(fields.second, cursor.getSeconds()))
      && fieldMatches(fields.minute, cursor.getMinutes())
      && fieldMatches(fields.hour, cursor.getHours())
      && fieldMatches(fields.dayOfMonth, cursor.getDate())
      && fieldMatches(fields.month, cursor.getMonth() + 1)
      && fieldMatches(fields.dayOfWeek, cursor.getDay())) results.push(new Date(cursor));
    cursor.setTime(cursor.getTime() + stepMilliseconds);
  }
  return results;
};
