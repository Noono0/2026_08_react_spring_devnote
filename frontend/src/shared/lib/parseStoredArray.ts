import type { z } from "zod";

// localStorage 등에 저장된 배열을 안전하게 읽는다. 저장 값은 사용자가 고칠 수 있는 "믿을 수 없는 입력"이다.
//   깨진 JSON·배열 아님 → 빈 배열, 일부 항목만 모양이 틀림 → 그 항목만 버리고 나머지는 살린다.
/** JSON 문법과 각 항목의 구조를 확인하며, 유효한 저장 항목은 보존합니다. */
export const parseStoredArray = <Value>(storedValue: string | null, schema: z.ZodType<Value>): Value[] => {
  if (!storedValue) return [];
  try {
    const parsed: unknown = JSON.parse(storedValue);
    if (!Array.isArray(parsed)) return [];
    // flatMap: 통과한 항목은 [값], 실패한 항목은 []를 돌려 한 번에 "거르기 + 꺼내기"를 한다.
    return parsed.flatMap((value: unknown) => {
      const result = schema.safeParse(value);
      return result.success ? [result.data] : [];
    });
  } catch {
    return [];
  }
};
