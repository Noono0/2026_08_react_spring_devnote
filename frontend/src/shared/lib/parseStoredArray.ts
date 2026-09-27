import type { z } from "zod";

/** JSON 문법과 각 항목의 구조를 확인하며, 유효한 저장 항목은 보존합니다. */
export const parseStoredArray = <Value>(storedValue: string | null, schema: z.ZodType<Value>): Value[] => {
  if (!storedValue) return [];
  try {
    const parsed: unknown = JSON.parse(storedValue);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((value: unknown) => {
      const result = schema.safeParse(value);
      return result.success ? [result.data] : [];
    });
  } catch {
    return [];
  }
};
